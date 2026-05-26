#!/usr/bin/env bash
#
# Deploy the "dnevnik" blog to the osokin.ai VDS.
# Run from your Mac:   bash dnevnik/deploy/deploy.sh
#
# Safe to re-run (idempotent): it re-syncs code, reinstalls deps, restarts the
# service, and redeploys /manifest. It never touches server posts/.env, and the
# nginx edit is backed up + tested + rolled back on failure.
#
set -euo pipefail

#################### EDIT IF NEEDED ####################
SSH_TARGET="${SSH_TARGET:-root@77.105.169.236}"   # user@host
SSH_OPTS="${SSH_OPTS:-}"                           # e.g. "-p 2222" for a custom port
#######################################################

WEBROOT=/var/www/osokin.ai
APP_DIR=/opt/dnevnik
PUBLIC_DIR="$WEBROOT/dnevnik"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # .../dnevnik/deploy
DNEVNIK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"                  # .../dnevnik
REPO_DIR="$(cd "$DNEVNIK_DIR/.." && pwd)"                    # repo root

SSH()   { ssh $SSH_OPTS "$SSH_TARGET" "$@"; }
# -rlpt (not -a): preserve perms+times but NOT owner/group, so server ownership
# stays as we set it (and macOS rsync/openrsync has no --chmod).
RSYNC() { rsync -rlptv -e "ssh $SSH_OPTS" "$@"; }

echo "==> Target: $SSH_TARGET"
command -v rsync >/dev/null || { echo "rsync not found locally"; exit 1; }
command -v node  >/dev/null || { echo "node not found locally (needed to hash the password)"; exit 1; }

# 1) Sync app code (server keeps its node_modules/.env/posts/public)
echo "==> [1/6] Syncing app code -> $APP_DIR"
SSH "mkdir -p $APP_DIR"
RSYNC --delete \
  --exclude node_modules --exclude .env --exclude public --exclude posts \
  "$DNEVNIK_DIR"/ "$SSH_TARGET:$APP_DIR/"

# 2) First-run secrets (.env) — only created if missing on the server
echo "==> [2/6] Checking server .env"
if [ "$(SSH "test -f $APP_DIR/.env && echo yes || echo no")" = "no" ]; then
  echo "    No .env on server — creating one (admin password + session secret)."
  read -rsp "    Set admin password: " PW1; echo
  read -rsp "    Repeat password:    " PW2; echo
  [ "$PW1" = "$PW2" ] || { echo "    Passwords do not match."; exit 1; }
  [ -n "$PW1" ]       || { echo "    Empty password."; exit 1; }
  HASH="$(cd "$DNEVNIK_DIR" && node bin/set-password.js "$PW1" | grep '^ADMIN_PASSWORD_HASH=')"
  SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  TMP_ENV="$(mktemp)"
  cat > "$TMP_ENV" <<ENV
NODE_ENV=production
PORT=4321
SESSION_SECRET=$SECRET
$HASH
POSTS_DIR=/var/lib/dnevnik/posts
PUBLIC_DIR=$PUBLIC_DIR
SITE_CSS=/manifest/style.css
ENV
  RSYNC "$TMP_ENV" "$SSH_TARGET:$APP_DIR/.env"
  rm -f "$TMP_ENV"
  echo "    .env uploaded."
else
  echo "    .env already exists — left untouched."
fi

# 3) Remote setup: service user, deps, systemd, nginx
echo "==> [3/6] Remote setup (deps, systemd service, nginx)"
SSH "bash -s" <<'REMOTE'
set -euo pipefail
WEBROOT=/var/www/osokin.ai
APP_DIR=/opt/dnevnik
PUBLIC_DIR="$WEBROOT/dnevnik"
POSTS_DIR=/var/lib/dnevnik/posts
RUN_USER=dnevnik
SERVICE=dnevnik
SITE_CONF=/etc/nginx/sites-enabled/osokin.ai

command -v node >/dev/null || { echo "ERROR: Node.js not installed on the server. Install Node >= 20.12 and re-run."; exit 1; }
NODE_BIN="$(command -v node)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || { echo "ERROR: Node >= 20.12 required (found $(node -v))."; exit 1; }

# Dedicated, login-less service user
id -u "$RUN_USER" >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin "$RUN_USER"

mkdir -p "$POSTS_DIR" "$PUBLIC_DIR"

cd "$APP_DIR"
npm install --omit=dev --no-audit --no-fund

chown -R "$RUN_USER:$RUN_USER" "$APP_DIR" "$POSTS_DIR" "$PUBLIC_DIR"
if [ -f "$APP_DIR/.env" ]; then chown "$RUN_USER:$RUN_USER" "$APP_DIR/.env"; chmod 600 "$APP_DIR/.env"; fi

# systemd unit (inject the real node path)
sed "s#__NODE__#${NODE_BIN}#" "$APP_DIR/deploy/dnevnik.service" > "/etc/systemd/system/${SERVICE}.service"
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null 2>&1 || true
systemctl restart "$SERVICE"
sleep 1
systemctl is-active --quiet "$SERVICE" && echo "    service active" || { echo "ERROR: $SERVICE failed to start:"; journalctl -u "$SERVICE" -n 20 --no-pager; exit 1; }

# nginx: install snippet, include it once, test, reload (rollback on failure)
mkdir -p /etc/nginx/snippets
cp "$APP_DIR/deploy/nginx-dnevnik.conf" /etc/nginx/snippets/dnevnik.conf

if grep -q "snippets/dnevnik.conf" "$SITE_CONF"; then
  echo "    nginx include already present."
else
  BACKUP="${SITE_CONF}.bak.$(date +%s)"
  cp "$SITE_CONF" "$BACKUP"
  echo "    backed up $SITE_CONF -> $BACKUP"
  # insert the include right after the first 'root ...;' line of the server block
  sed -i "0,/^[[:space:]]*root[[:space:]].*;/s##&\n    include snippets/dnevnik.conf;#" "$SITE_CONF"
  if ! grep -q "snippets/dnevnik.conf" "$SITE_CONF"; then
    echo "ERROR: could not auto-insert the include (no 'root ...;' line found)."
    echo "Add this inside the osokin.ai server block manually, then: nginx -t && systemctl reload nginx"
    echo "    include snippets/dnevnik.conf;"
    exit 1
  fi
fi

if nginx -t; then
  systemctl reload nginx
  echo "    nginx reloaded."
else
  echo "ERROR: nginx config test failed — restoring backup."
  LATEST_BAK="$(ls -t ${SITE_CONF}.bak.* 2>/dev/null | head -n1 || true)"
  [ -n "$LATEST_BAK" ] && cp "$LATEST_BAK" "$SITE_CONF"
  nginx -t && systemctl reload nginx || true
  exit 1
fi
REMOTE

# 4) Redeploy /manifest with the new "Заметки" menu link
echo "==> [4/6] Redeploying /manifest (adds the menu entry)"
RSYNC "$REPO_DIR/manifest"/ "$SSH_TARGET:$WEBROOT/manifest/"

# 5) Smoke test (server-local, before the public URL)
echo "==> [5/6] Smoke test"
SSH "curl -s -o /dev/null -w '    local wall  -> %{http_code}\n' http://127.0.0.1:4321/dnevnik/" || true
SSH "curl -s -o /dev/null -w '    local admin -> %{http_code}\n' http://127.0.0.1:4321/dnevnik/admin" || true

echo "==> [6/6] Done."
echo "    Wall:   https://osokin.ai/dnevnik/"
echo "    Editor: https://osokin.ai/dnevnik/admin"

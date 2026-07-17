#!/usr/bin/env bash
#
# Deploy pay-bot (course payment lead relay) to the osokin.ai VDS.
# Run from your Mac:   bash pay-bot/deploy/deploy.sh
#
# Safe to re-run (idempotent): re-syncs code, restarts the service, ensures the
# nginx include (backed up + tested + rolled back on failure). It never touches
# the server .env with your bot token once created.
#
# Zero npm dependencies — the service uses only Node built-ins.
#
set -euo pipefail

#################### EDIT IF NEEDED ####################
SSH_TARGET="${SSH_TARGET:-root@77.105.169.236}"   # user@host
SSH_OPTS="${SSH_OPTS:-}"                           # e.g. "-p 2222" for a custom port
#######################################################

APP_DIR=/opt/pay-bot

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # .../pay-bot/deploy
PAYBOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"                   # .../pay-bot

SSH()   { ssh $SSH_OPTS "$SSH_TARGET" "$@"; }
RSYNC() { rsync -rlptv -e "ssh $SSH_OPTS" "$@"; }

echo "==> Target: $SSH_TARGET"
command -v rsync >/dev/null || { echo "rsync not found locally"; exit 1; }

# 1) Sync app code (server keeps its .env)
echo "==> [1/4] Syncing app code -> $APP_DIR"
SSH "mkdir -p $APP_DIR"
RSYNC --delete --exclude .env "$PAYBOT_DIR"/ "$SSH_TARGET:$APP_DIR/"

# 2) First-run secrets (.env) — only created if missing on the server
echo "==> [2/4] Checking server .env (bot token + chat id + optional proxy)"
if [ "$(SSH "test -f $APP_DIR/.env && echo yes || echo no")" = "no" ]; then
  echo "    No .env on server — let's create it."
  read -rp   "    Bot token (from @BotFather): " BOT_TOKEN
  read -rp   "    Chat id (channel/group, e.g. -1003968370164): " CHAT_ID
  # RF servers can't reach api.telegram.org directly — route via an HTTP proxy.
  read -rp   "    Proxy URL for Telegram (http://user:pass@host:port, blank = direct): " PROXY_URL
  [ -n "$BOT_TOKEN" ] || { echo "    Empty token."; exit 1; }
  [ -n "$CHAT_ID" ]   || { echo "    Empty chat id."; exit 1; }
  TMP_ENV="$(mktemp)"
  {
    echo "PORT=4332"
    echo "BOT_TOKEN=$BOT_TOKEN"
    echo "CHAT_ID=$CHAT_ID"
    [ -n "$PROXY_URL" ] && echo "PROXY_URL=$PROXY_URL"
  } > "$TMP_ENV"
  RSYNC "$TMP_ENV" "$SSH_TARGET:$APP_DIR/.env"
  rm -f "$TMP_ENV"
  echo "    .env uploaded."
else
  echo "    .env already exists — left untouched."
fi

# 3) Remote setup: service user, systemd, nginx
echo "==> [3/4] Remote setup (systemd service, nginx)"
SSH "bash -s" <<'REMOTE'
set -euo pipefail
APP_DIR=/opt/pay-bot
RUN_USER=pay-bot
SERVICE=pay-bot
SITE_CONF=/etc/nginx/sites-enabled/osokin.ai

command -v node >/dev/null || { echo "ERROR: Node.js not installed on the server."; exit 1; }
NODE_BIN="$(command -v node)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || { echo "ERROR: Node >= 18 required (found $(node -v))."; exit 1; }

# Dedicated, login-less service user
id -u "$RUN_USER" >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin "$RUN_USER"

chown -R "$RUN_USER:$RUN_USER" "$APP_DIR"
if [ -f "$APP_DIR/.env" ]; then chown "$RUN_USER:$RUN_USER" "$APP_DIR/.env"; chmod 600 "$APP_DIR/.env"; fi

# systemd unit (inject the real node path)
sed "s#__NODE__#${NODE_BIN}#" "$APP_DIR/deploy/pay-bot.service" > "/etc/systemd/system/${SERVICE}.service"
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null 2>&1 || true
systemctl restart "$SERVICE"
sleep 1
systemctl is-active --quiet "$SERVICE" && echo "    service active" || { echo "ERROR: $SERVICE failed to start:"; journalctl -u "$SERVICE" -n 20 --no-pager; exit 1; }

# nginx: install snippet, include it once, test, reload (rollback on failure)
mkdir -p /etc/nginx/snippets
cp "$APP_DIR/deploy/nginx-pay-bot.conf" /etc/nginx/snippets/pay-bot.conf

if grep -q "snippets/pay-bot.conf" "$SITE_CONF"; then
  echo "    nginx include already present."
else
  mkdir -p /etc/nginx/backups
  BACKUP="/etc/nginx/backups/$(basename "$SITE_CONF").bak.$(date +%s)"
  cp "$SITE_CONF" "$BACKUP"
  echo "    backed up $SITE_CONF -> $BACKUP"
  sed -i "0,/^[[:space:]]*root[[:space:]].*;/s##&\n    include snippets/pay-bot.conf;#" "$SITE_CONF"
  if ! grep -q "snippets/pay-bot.conf" "$SITE_CONF"; then
    echo "ERROR: could not auto-insert the include (no 'root ...;' line found)."
    echo "Add this inside the osokin.ai server block manually, then: nginx -t && systemctl reload nginx"
    echo "    include snippets/pay-bot.conf;"
    exit 1
  fi
fi

if nginx -t; then
  systemctl reload nginx
  echo "    nginx reloaded."
else
  echo "ERROR: nginx config test failed — restoring backup."
  LATEST_BAK="$(ls -t /etc/nginx/backups/$(basename "$SITE_CONF").bak.* 2>/dev/null | head -n1 || true)"
  [ -n "$LATEST_BAK" ] && cp "$LATEST_BAK" "$SITE_CONF"
  nginx -t && systemctl reload nginx || true
  exit 1
fi
REMOTE

# 4) Smoke test (server-local): a bad request should return 400, not 5xx
echo "==> [4/4] Smoke test"
SSH "curl -s -o /dev/null -w '    local pay-lead (empty POST) -> %{http_code} (ждём 400)\n' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:4332/mastering-ai/api/pay-lead" || true

echo "==> Done. Endpoint: https://osokin.ai/mastering-ai/api/pay-lead"
echo "    Токен и chat id лежат на сервере в /opt/pay-bot/.env (chmod 600), в репозиторий не попадают."

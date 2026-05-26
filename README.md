# osokin.ai

Source for the **osokin.ai** site. Three independent parts live here:

| Path        | URL                     | What it is                                              |
|-------------|-------------------------|---------------------------------------------------------|
| `index.html`, `style.css`, `script.js`, `photo.png` | `osokin.ai/` | The personal landing page (plain static). |
| `manifest/` | `osokin.ai/manifest/`   | "Путь" — a hand-crafted multi-page essay (static).      |
| `dnevnik/`  | `osokin.ai/dnevnik/`    | "Заметки" — a small markdown blog engine (Node service).|

## How production actually works

**The live site is served by nginx on a VDS.** That is the source of truth.

- Host: `root@77.105.169.236` (configured in `dnevnik/deploy/deploy.sh`).
- Webroot: `/var/www/osokin.ai` (nginx `root`).
- nginx site config: `/etc/nginx/sites-enabled/osokin.ai`.

> **Gotcha:** `wrangler.jsonc` (Cloudflare) and `CNAME` (GitHub Pages) are
> leftover artifacts from earlier hosting experiments. They are **not** how the
> site is served today — ignore them unless you are deliberately migrating.

Deploying = getting files onto that VDS:

- **Static parts** (`index.html`, `manifest/`) → `rsync` into the webroot.
  Example (run from the repo root on macOS):
  ```bash
  rsync -rlptv ./manifest/ root@77.105.169.236:/var/www/osokin.ai/manifest/
  ```
- **`dnevnik/`** (the blog) → `bash dnevnik/deploy/deploy.sh` (see below).

## dnevnik — the blog engine

A single-author markdown blog. The author logs in, writes posts, and marks each
one public or private. Public posts are rendered to static HTML on save;
private posts and the editor live behind a password.

### Model

- **Entry point:** a "Заметки" link in the top menu of the manifest pages →
  `/dnevnik/`.
- **`/dnevnik/`** — the public "wall": lists only posts marked **public**, with
  pagination (10/page), sort (old↔new), and substring search (title + body).
  A top "Авторизоваться" button → login.
- **`/dnevnik/admin`** — login (single password, **no signup**). Once in: a list
  of **all** posts (public + private) with the same search/sort/pagination, an
  inline public/private toggle, and the editor.
- **`/dnevnik/<slug>.html`** — a published post page, static, styled to match
  the rest of the site.
- Toggling a post to **private** removes its static page (404 publicly) but it
  stays visible/editable in the admin list. Toggling back regenerates it.

### Code map (`dnevnik/`)

| File                 | Responsibility                                                    |
|----------------------|-------------------------------------------------------------------|
| `server.js`          | Express app: routes for wall / admin / api / static post pages.   |
| `lib/config.js`      | Env + paths. Reads `.env` (Node `process.loadEnvFile`).           |
| `lib/auth.js`        | scrypt password hash, HMAC-signed session cookie (14-day TTL).    |
| `lib/store.js`       | Posts as `.md` files (gray-matter frontmatter); search/sort/page. |
| `lib/render.js`      | markdown→HTML (marked + sanitize-html), page templates, static regen. |
| `lib/views.js`       | Admin HTML (login, dashboard, editor with live preview).          |
| `bin/set-password.js`| Generates an `ADMIN_PASSWORD_HASH` line for `.env`.               |
| `deploy/`            | `deploy.sh`, `dnevnik.service` (systemd), `nginx-dnevnik.conf`.    |

- Posts are markdown with frontmatter: `title`, `date`, `updated`, `published`.
  `published: true` == public. Markdown `#` headings are shifted to `<h2>` so
  they map onto the site's `.prose` styling (the page `<h1>` is the title).
- Reader pages reuse `/manifest/style.css` (the book aesthetic) plus a little
  inline CSS, so posts look native to the site.

### Run locally

```bash
cd dnevnik
npm install
node server.js
# → http://localhost:4321/dnevnik/   (admin: /dnevnik/admin, dev password: "dev")
```

In dev (`NODE_ENV` unset) the server also serves `/manifest/*` and redirects
`/` → `/dnevnik/`, so the whole site works on localhost. There is a
`.claude/launch.json` config named `dnevnik` for the preview tooling.

### Deploy

```bash
bash dnevnik/deploy/deploy.sh           # custom SSH port: SSH_OPTS="-p 2222" bash ...
```

The script (idempotent, safe to re-run) syncs code to `/opt/dnevnik`, runs
`npm install`, installs a `dnevnik` systemd service on `127.0.0.1:4321`, wires
nginx (backup → `nginx -t` → reload, auto-rollback on failure), and redeploys
`/manifest`. On the **first** run it prompts for an admin password (hashed
locally; only the hash + a random session secret are written to the server
`.env`).

**Server-side layout after deploy:**

| Path                              | What                                          |
|-----------------------------------|-----------------------------------------------|
| `/opt/dnevnik`                    | App code + `node_modules` + `.env` (chmod 600).|
| `/var/lib/dnevnik/posts`          | Markdown posts — **the data; back this up.**  |
| `/var/www/osokin.ai/dnevnik/`     | Generated static post pages (served by nginx).|
| `/etc/systemd/system/dnevnik.service` | The service unit.                         |
| `/etc/nginx/snippets/dnevnik.conf`| The `/dnevnik` routing, `include`d in the site.|

**Requirement:** Node **≥ 20.12** must be installed on the VDS (`process.loadEnvFile`).
The script checks and aborts with a message if missing.

**Rollback / uninstall:**
```bash
systemctl disable --now dnevnik
# restore /etc/nginx/sites-enabled/osokin.ai.bak.* and: nginx -t && systemctl reload nginx
```

## Conventions & gotchas (read before editing)

- **Don't rewrite the existing manifest/landing page content.** The "Заметки"
  menu link is the only intended change to those hand-crafted pages.
- **macOS `rsync` is `openrsync`** — it rejects `--chmod=...`. Fix file modes
  locally first (`chmod 644`) and rsync with `-rlptv` (perms preserved, owner
  not). Files downloaded from the browser arrive `600` → nginx returns **403**
  if you ship them as-is.
- nginx serves `/manifest` (no trailing slash) by 301-redirecting to
  `/manifest/`, so the relative links inside those pages resolve correctly.
- `dnevnik/posts/` and `dnevnik/public/` are gitignored and **not** deployed
  (the server has its own copies); production starts with no posts.
- Production cookies are `Secure` + `httpOnly`; the app sets `trust proxy` when
  `NODE_ENV=production` because it sits behind nginx.

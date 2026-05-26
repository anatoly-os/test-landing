import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { PORT, PUBLIC_DIR, BASE_PATH, ROOT, IS_DEV } from "./lib/config.js";
import {
  checkPassword,
  startSession,
  endSession,
  isAuthed,
  requireAuth,
} from "./lib/auth.js";
import {
  readPost,
  savePost,
  deletePost,
  queryPosts,
} from "./lib/store.js";
import { renderMarkdown, renderWall, regenerateSite } from "./lib/render.js";
import { loginView, dashboardView, editorView } from "./lib/views.js";

const app = express();
app.disable("x-powered-by");
if (!IS_DEV) app.set("trust proxy", 1); // behind nginx in production
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

const LOGIN_URL = `${BASE_PATH}/admin`;
const auth = requireAuth(LOGIN_URL);

function parseQuery(req) {
  return {
    q: typeof req.query.q === "string" ? req.query.q : "",
    sort: req.query.sort === "asc" ? "asc" : "desc",
    page: Number(req.query.page) || 1,
  };
}

// --- admin (editor) ---------------------------------------------------------
const admin = express.Router();

admin.get("/", (req, res) => {
  if (!isAuthed(req)) return res.send(loginView());
  const { q, sort, page } = parseQuery(req);
  res.send(dashboardView(queryPosts({ publishedOnly: false, q, sort, page })));
});

admin.post("/login", (req, res) => {
  if (checkPassword(req.body?.password || "")) {
    startSession(res);
    return res.redirect(`${BASE_PATH}/admin`);
  }
  res.status(401).send(loginView({ error: "Неверный пароль" }));
});

admin.post("/logout", (req, res) => {
  endSession(res);
  res.redirect(`${BASE_PATH}/admin`);
});

admin.get("/new", auth, (req, res) => res.send(editorView(null)));

admin.get("/edit/:slug", auth, (req, res) => {
  const post = readPost(req.params.slug);
  if (!post) return res.status(404).send("Запись не найдена");
  res.send(editorView(post));
});

// Toggle the public flag from the dashboard list.
admin.post("/toggle/:slug", auth, (req, res) => {
  const post = readPost(req.params.slug);
  if (post) {
    savePost({
      slug: post.slug,
      title: post.title,
      markdown: post.markdown,
      published: !post.published,
      date: post.date,
    });
    regenerateSite();
  }
  res.redirect(req.get("referer") || `${BASE_PATH}/admin`);
});

app.use(`${BASE_PATH}/admin`, admin);

// --- api --------------------------------------------------------------------
const api = express.Router();
api.use(auth);

api.post("/preview", (req, res) => {
  res.json({ html: renderMarkdown(req.body?.markdown || "") });
});

api.post("/posts", (req, res) => {
  const { slug, title, markdown, published } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Заголовок обязателен" });
  }
  const post = savePost({ slug: slug || null, title, markdown, published });
  regenerateSite();
  res.json({ slug: post.slug, published: post.published });
});

api.post("/posts/:slug/delete", (req, res) => {
  deletePost(req.params.slug);
  regenerateSite();
  res.json({ ok: true });
});

app.use(`${BASE_PATH}/api`, api);

// --- public wall (dynamic: pagination / sort / search) ----------------------
function wall(req, res) {
  const { q, sort, page } = parseQuery(req);
  const result = queryPosts({ publishedOnly: true, q, sort, page });
  res.send(renderWall({ ...result, authed: isAuthed(req) }));
}
app.get(BASE_PATH, wall);
app.get(`${BASE_PATH}/`, wall);

// --- public static post pages (generated on save) ---------------------------
app.use(
  BASE_PATH,
  express.static(PUBLIC_DIR, { extensions: ["html"], index: false }),
);

// Dev convenience: serve the manifest static files so /manifest/style.css and
// the existing pages resolve on localhost. In production nginx serves these.
if (IS_DEV) {
  app.use("/manifest", express.static(path.join(ROOT, "..", "manifest")));
  app.get("/", (req, res) => res.redirect(`${BASE_PATH}/`));
}

regenerateSite();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[dnevnik] http://localhost:${PORT}${BASE_PATH}/  (admin: ${BASE_PATH}/admin)`);
});

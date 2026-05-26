import fs from "node:fs";
import path from "node:path";
import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { PUBLIC_DIR, BASE_PATH, SITE_CSS } from "./config.js";
import { listPosts } from "./store.js";

const marked = new Marked({
  gfm: true,
  breaks: false,
  // Shift heading levels down by one so the author's "# Heading" maps onto
  // the .prose h2 styling (the page <h1> is the post title).
  walkTokens(token) {
    if (token.type === "heading") token.depth = Math.min(token.depth + 1, 6);
  },
});

const SANITIZE_OPTS = {
  allowedTags: [
    "p", "br", "hr", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "strong", "em", "b", "i", "u", "s",
    "blockquote", "a", "code", "pre", "img",
    "table", "thead", "tbody", "tr", "th", "td", "figure", "figcaption",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href || "";
      const external = /^https?:\/\//i.test(href);
      return {
        tagName: "a",
        attribs: external
          ? { ...attribs, target: "_blank", rel: "noopener noreferrer" }
          : attribs,
      };
    },
  },
};

export function renderMarkdown(md) {
  const html = marked.parse(md || "");
  return sanitizeHtml(html, SANITIZE_OPTS);
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function masthead(current) {
  const link = (href, label, key) =>
    `<a href="${href}"${current === key ? ' class="current"' : ""}>${label}</a>`;
  return `<header class="masthead">
  <div class="wrap">
    <a class="brand" href="/manifest/index.html">
      <span class="seal">道</span>
      <span class="brand-name">Путь</span>
    </a>
    <nav class="nav">
      ${link("/manifest/index.html", "Манифест", "manifest")}
      ${link("/manifest/yazyk.html", "Язык", "yazyk")}
      ${link("/manifest/golos.html", "Голос", "golos")}
      ${link(`${BASE_PATH}/`, "Заметки", "zametki")}
    </nav>
  </div>
</header>`;
}

// Small supplemental styles for blog-specific elements, layered on top of the
// shared book stylesheet so posts look native to the site.
const EXTRA_CSS = `
  .post-meta { font-size:0.74rem; letter-spacing:0.16em; text-transform:uppercase;
    color:var(--ink-faint); margin-top:1.4rem; }
  .post-list { list-style:none; padding:0; margin:0; }
  .post-list li { margin:0; padding:0; }
  .post-list li::before { display:none; }
  .post-item { display:block; text-decoration:none; color:var(--ink);
    padding:1.8rem 0; border-bottom:1px solid var(--line-soft); transition:color .2s ease; }
  .post-item:hover { color:var(--seal); }
  .post-item .pi-date { font-size:0.72rem; letter-spacing:0.15em; text-transform:uppercase;
    color:var(--ink-faint); margin-bottom:0.5rem; }
  .post-item h2 { font-family:var(--serif-display); font-weight:500;
    font-size:clamp(1.5rem,3.5vw,2rem); line-height:1.15; margin:0; }
  .post-item h2::before { display:none; }
  .post-empty { color:var(--ink-soft); font-style:italic; }
  .wall-bar { display:flex; align-items:center; justify-content:flex-end; gap:1rem;
    margin-top:-1rem; margin-bottom:0.5rem; }
  .wall-bar a { font-size:0.72rem; letter-spacing:0.15em; text-transform:uppercase;
    color:var(--seal); text-decoration:none; border-bottom:1px solid rgba(168,60,43,0.4); }
  .wall-bar a:hover { border-color:var(--seal); }
  .controls { display:flex; flex-wrap:wrap; gap:1rem; align-items:center;
    justify-content:space-between; margin:0.5rem 0 1.5rem; }
  .controls form { display:flex; gap:0.5rem; flex:1; min-width:200px; }
  .controls input[type=search] { flex:1; font-family:var(--serif-text); font-size:0.95rem;
    padding:0.5rem 0.7rem; border:1px solid var(--line); background:var(--paper-raised);
    color:var(--ink); border-radius:3px; }
  .controls input[type=search]:focus { outline:none; border-color:var(--seal); }
  .controls .sort-link { font-size:0.72rem; letter-spacing:0.14em; text-transform:uppercase;
    color:var(--ink-soft); text-decoration:none; white-space:nowrap; }
  .controls .sort-link:hover { color:var(--seal); }
  .pager-nums { display:flex; gap:0.4rem; align-items:center; justify-content:center;
    margin:2.5rem 0 0; flex-wrap:wrap; }
  .pager-nums a, .pager-nums span { font-size:0.85rem; padding:0.35rem 0.7rem;
    border:1px solid var(--line); border-radius:3px; text-decoration:none; color:var(--ink-soft); }
  .pager-nums a:hover { border-color:var(--seal); color:var(--seal); }
  .pager-nums .on { background:var(--seal); color:var(--paper-raised); border-color:var(--seal); }
  .pager-nums .off { opacity:0.4; pointer-events:none; }
`;

function page({ title, description = "", current, body, robots = "" }) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
${robots ? `<meta name="robots" content="${robots}">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Spectral:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${SITE_CSS}">
<style>${EXTRA_CSS}</style>
</head>
<body>
${masthead(current)}
<main class="page">
${body}
  <footer class="colophon">
    <div class="wrap"><div class="measure">
      <p>Заметки на Пути.</p>
      <span class="mark">道</span>
    </div></div>
  </footer>
</main>
</body>
</html>
`;
}

export function renderPostPage(post) {
  const bodyHtml = renderMarkdown(post.markdown);
  const body = `  <section class="head">
    <div class="wrap">
      <div class="watermark" aria-hidden="true">言</div>
      <div class="measure">
        <nav class="breadcrumb">
          <a href="/manifest/index.html">Путь</a><span class="sep">›</span>
          <a href="${BASE_PATH}/">Заметки</a><span class="sep">›</span>
          ${escapeHtml(post.title)}
        </nav>
        <h1 class="title title--page">${escapeHtml(post.title)}</h1>
        <p class="post-meta">${formatDate(post.date)}</p>
      </div>
    </div>
  </section>

  <article class="prose">
    <div class="wrap"><div class="measure">
      <div class="divider"><span></span></div>
${bodyHtml}
    </div></div>
  </article>

  <div class="wrap"><div class="measure">
    <nav class="pager">
      <a class="prev" href="${BASE_PATH}/">
        <span class="dir">← Все заметки</span>
        <span class="pg-title">Заметки</span>
      </a>
    </nav>
  </div></div>`;
  return page({
    title: `${post.title} — Заметки · Путь`,
    description: post.title,
    current: "zametki",
    body,
  });
}

function qstring(params) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== "" && v != null && !(k === "page" && v === 1)) usp.set(k, v);
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

function controls({ q, sort }) {
  const nextSort = sort === "asc" ? "desc" : "asc";
  const sortLabel = sort === "asc" ? "Старые → новые" : "Новые → старые";
  return `<div class="controls">
    <form method="get" action="${BASE_PATH}/">
      <input type="search" name="q" value="${escapeHtml(q)}" placeholder="Поиск по заметкам…">
      ${sort !== "desc" ? `<input type="hidden" name="sort" value="${sort}">` : ""}
      <button class="btn" type="submit" style="font-family:var(--serif-text);font-size:0.75rem;letter-spacing:0.08em;text-transform:uppercase;padding:0.5rem 1rem;border:1px solid var(--seal);background:var(--seal);color:var(--paper-raised);border-radius:3px;cursor:pointer;">Найти</button>
    </form>
    <a class="sort-link" href="${BASE_PATH}/${qstring({ q, sort: nextSort })}">↕ ${sortLabel}</a>
  </div>`;
}

function pagination({ page: cur, pages, q, sort }, basePath) {
  if (pages <= 1) return "";
  const link = (p, label, cls = "") =>
    `<a class="${cls}" href="${basePath}${qstring({ q, sort: sort === "desc" ? "" : sort, page: p })}">${label}</a>`;
  const prev = cur > 1 ? link(cur - 1, "← Назад") : `<span class="off">← Назад</span>`;
  const next = cur < pages ? link(cur + 1, "Вперёд →") : `<span class="off">Вперёд →</span>`;
  let nums = "";
  for (let p = 1; p <= pages; p++) {
    nums += p === cur ? `<span class="on">${p}</span>` : link(p, String(p));
  }
  return `<div class="pager-nums">${prev}${nums}${next}</div>`;
}

// Public "wall" of published posts — rendered dynamically (pagination/sort/search).
export function renderWall({ items, page: cur, pages, q, sort, total, authed }) {
  const authBtn = authed
    ? `<a href="${BASE_PATH}/admin">Панель →</a>`
    : `<a href="${BASE_PATH}/admin">Авторизоваться</a>`;

  const list = items.length
    ? `<ul class="post-list">
${items
  .map(
    (p) => `      <li><a class="post-item" href="${BASE_PATH}/${p.slug}.html">
        <span class="pi-date">${formatDate(p.date)}</span>
        <h2>${escapeHtml(p.title)}</h2>
      </a></li>`,
  )
  .join("\n")}
    </ul>`
    : `<p class="post-empty">${q ? "Ничего не найдено." : "Пока ни одной публичной заметки."}</p>`;

  const body = `  <section class="head">
    <div class="wrap">
      <div class="watermark" aria-hidden="true">言</div>
      <div class="measure">
        <div class="kicker">Заметки на Пути</div>
        <h1 class="title title--page">Заметки</h1>
        <p class="subtitle">Записи о пути изучения</p>
      </div>
    </div>
  </section>

  <article class="prose">
    <div class="wrap"><div class="measure">
      <div class="wall-bar">${authBtn}</div>
      ${controls({ q, sort })}
      <div class="divider"><span></span></div>
${list}
      ${pagination({ page: cur, pages, q, sort }, `${BASE_PATH}/`)}
    </div></div>
  </article>`;
  return page({
    title: "Заметки — Путь",
    description: "Записи о пути изучения китайской культуры.",
    current: "zametki",
    body,
  });
}

// Regenerate static post pages for all public posts. Private posts get no
// public file (so they are not reachable without the editor).
export function regenerateSite() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  const published = listPosts({ publishedOnly: true });

  for (const f of fs.readdirSync(PUBLIC_DIR)) {
    if (f.endsWith(".html")) fs.unlinkSync(path.join(PUBLIC_DIR, f));
  }
  for (const post of published) {
    fs.writeFileSync(
      path.join(PUBLIC_DIR, `${post.slug}.html`),
      renderPostPage(post),
      "utf8",
    );
  }
  return { count: published.length };
}

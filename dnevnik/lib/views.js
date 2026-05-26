import { BASE_PATH, SITE_CSS } from "./config.js";
import { formatDate } from "./render.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ADMIN_CSS = `
  body { padding-bottom: 4rem; }
  .admin-wrap { max-width: 70rem; margin: 0 auto; padding: 2.5rem 2rem; position: relative; z-index: 1; }
  .admin-bar { display:flex; align-items:center; justify-content:space-between; gap:1rem;
    padding-bottom:1.4rem; margin-bottom:2rem; border-bottom:1px solid var(--line); }
  .admin-bar .crumbs { font-family:var(--serif-display); font-size:1.5rem; font-weight:600; }
  .admin-bar .crumbs a { color:var(--seal); text-decoration:none; }
  .btn { font-family:var(--serif-text); font-size:0.8rem; letter-spacing:0.08em;
    text-transform:uppercase; padding:0.6rem 1.1rem; border:1px solid var(--seal);
    background:var(--seal); color:var(--paper-raised); cursor:pointer; border-radius:3px;
    text-decoration:none; display:inline-block; transition:opacity .2s ease; }
  .btn:hover { opacity:0.88; }
  .btn--ghost { background:transparent; color:var(--seal); }
  .btn--danger { border-color:#8a2e1f; background:transparent; color:#8a2e1f; }
  .field { margin-bottom:1.2rem; }
  .field label { display:block; font-size:0.72rem; letter-spacing:0.15em; text-transform:uppercase;
    color:var(--ink-faint); margin-bottom:0.5rem; }
  input[type=text], input[type=password] { width:100%; font-family:var(--serif-display);
    font-size:1.6rem; font-weight:500; padding:0.5rem 0.2rem; border:none; border-bottom:1px solid var(--line);
    background:transparent; color:var(--ink); }
  input:focus, textarea:focus { outline:none; border-color:var(--seal); }
  .login-box { max-width:24rem; margin:8vh auto 0; }
  .login-box input { font-size:1.1rem; }
  .login-box .btn { width:100%; text-align:center; margin-top:1rem; }
  .error { color:#8a2e1f; font-size:0.9rem; margin:0.8rem 0; }
  .editor-grid { display:grid; grid-template-columns:1fr 1fr; gap:2rem; align-items:start; }
  .toolbar { display:flex; flex-wrap:wrap; gap:0.4rem; margin-bottom:0.6rem; }
  .toolbar button { font-family:var(--serif-text); font-size:0.85rem; padding:0.3rem 0.6rem;
    border:1px solid var(--line); background:var(--paper-raised); color:var(--ink-soft);
    cursor:pointer; border-radius:3px; }
  .toolbar button:hover { border-color:var(--seal); color:var(--seal); }
  textarea#md { width:100%; min-height:60vh; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
    font-size:0.95rem; line-height:1.7; padding:1rem; border:1px solid var(--line);
    background:var(--paper-raised); color:var(--ink); border-radius:3px; resize:vertical; }
  .preview-pane { border:1px solid var(--line-soft); background:var(--paper-raised);
    border-radius:3px; padding:1.5rem 1.8rem; min-height:60vh; }
  .preview-pane .prose { padding:0; }
  .pane-label { font-size:0.7rem; letter-spacing:0.15em; text-transform:uppercase;
    color:var(--ink-faint); margin-bottom:0.6rem; }
  .editor-actions { display:flex; align-items:center; gap:1rem; margin:1.5rem 0; flex-wrap:wrap; }
  .editor-actions label { font-size:0.85rem; color:var(--ink-soft); display:flex; align-items:center; gap:0.4rem; }
  .save-state { font-size:0.8rem; color:var(--ink-faint); }
  .post-rows { list-style:none; padding:0; margin:0; }
  .post-rows li { display:flex; align-items:baseline; justify-content:space-between; gap:1rem;
    padding:1rem 0; border-bottom:1px solid var(--line-soft); }
  .post-rows .pr-title { font-family:var(--serif-display); font-size:1.3rem; font-weight:500;
    color:var(--ink); text-decoration:none; }
  .post-rows .pr-title:hover { color:var(--seal); }
  .post-rows .pr-meta { font-size:0.72rem; letter-spacing:0.12em; text-transform:uppercase; color:var(--ink-faint); }
  .badge-draft { color:#8a2e1f; }
  .controls { display:flex; flex-wrap:wrap; gap:1rem; align-items:center;
    justify-content:space-between; margin:0 0 1.5rem; }
  .controls form { display:flex; gap:0.5rem; flex:1; min-width:220px; }
  .controls input[type=search] { flex:1; font-family:var(--serif-text); font-size:0.95rem;
    padding:0.5rem 0.7rem; border:1px solid var(--line); background:var(--paper-raised);
    color:var(--ink); border-radius:3px; }
  .controls input[type=search]:focus { outline:none; border-color:var(--seal); }
  .controls .btn { font-size:0.72rem; padding:0.5rem 1rem; }
  .controls .sort-link { font-size:0.72rem; letter-spacing:0.14em; text-transform:uppercase;
    color:var(--ink-soft); text-decoration:none; white-space:nowrap; }
  .controls .sort-link:hover { color:var(--seal); }
  .pr-meta { display:flex; align-items:center; gap:1rem; }
  .pr-date { font-variant-numeric:tabular-nums; }
  .badge { font-size:0.64rem; letter-spacing:0.12em; text-transform:uppercase;
    padding:0.2rem 0.5rem; border-radius:3px; border:1px solid var(--line); }
  .badge-public { color:var(--seal); border-color:rgba(168,60,43,0.4); }
  .badge-private { color:var(--ink-faint); }
  .toggle-form { display:inline; margin:0; }
  .link-btn { background:none; border:none; color:var(--seal); cursor:pointer;
    font-family:var(--serif-text); font-size:0.78rem; letter-spacing:0.1em;
    text-transform:uppercase; padding:0; border-bottom:1px solid rgba(168,60,43,0.4); }
  .link-btn:hover { border-color:var(--seal); }
  .pager-nums { display:flex; gap:0.4rem; align-items:center; justify-content:center;
    margin:2rem 0 0; flex-wrap:wrap; }
  .pager-nums a, .pager-nums span { font-size:0.85rem; padding:0.35rem 0.7rem;
    border:1px solid var(--line); border-radius:3px; text-decoration:none; color:var(--ink-soft); }
  .pager-nums a:hover { border-color:var(--seal); color:var(--seal); }
  .pager-nums .on { background:var(--seal); color:var(--paper-raised); border-color:var(--seal); }
  .pager-nums .off { opacity:0.4; pointer-events:none; }
  @media (max-width:760px){ .editor-grid{ grid-template-columns:1fr; }
    .post-rows li{ flex-wrap:wrap; } }
`;

function shell(title, body) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Spectral:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${SITE_CSS}">
<style>${ADMIN_CSS}</style>
</head>
<body>
<div class="admin-wrap">
${body}
</div>
</body>
</html>`;
}

export function loginView({ error } = {}) {
  return shell(
    "Вход — Дневник",
    `<form class="login-box" method="post" action="${BASE_PATH}/admin/login">
  <div class="admin-bar"><span class="crumbs">Дневник</span></div>
  <div class="field">
    <label for="pw">Пароль</label>
    <input type="password" id="pw" name="password" autofocus autocomplete="current-password">
  </div>
  ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
  <button class="btn" type="submit">Войти</button>
</form>`,
  );
}

function qstring(params) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== "" && v != null && !(k === "page" && v === 1) && !(k === "sort" && v === "desc")) {
      usp.set(k, v);
    }
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export function dashboardView({ items, total, page: cur, pages, sort, q }) {
  const adminBase = `${BASE_PATH}/admin`;
  const nextSort = sort === "asc" ? "desc" : "asc";
  const sortLabel = sort === "asc" ? "Старые → новые" : "Новые → старые";

  const controls = `<div class="controls">
  <form method="get" action="${adminBase}">
    <input type="search" name="q" value="${escapeHtml(q)}" placeholder="Поиск по всем заметкам…">
    ${sort !== "desc" ? `<input type="hidden" name="sort" value="${escapeHtml(sort)}">` : ""}
    <button class="btn" type="submit">Найти</button>
  </form>
  <a class="sort-link" href="${adminBase}${qstring({ q, sort: nextSort })}">↕ ${sortLabel}</a>
</div>`;

  const rows = items.length
    ? `<ul class="post-rows">
${items
  .map((p) => {
    const toggleLabel = p.published ? "Скрыть" : "Опубликовать";
    return `  <li>
    <a class="pr-title" href="${adminBase}/edit/${p.slug}">${escapeHtml(p.title)}</a>
    <span class="pr-meta">
      <span class="badge ${p.published ? "badge-public" : "badge-private"}">${p.published ? "публичный" : "приватный"}</span>
      <span class="pr-date">${formatDate(p.date)}</span>
      <form class="toggle-form" method="post" action="${adminBase}/toggle/${p.slug}">
        <button type="submit" class="link-btn">${toggleLabel}</button>
      </form>
    </span>
  </li>`;
  })
  .join("\n")}
</ul>`
    : `<p style="color:var(--ink-soft);font-style:italic;">${q ? "Ничего не найдено." : "Записей пока нет. Создайте первую."}</p>`;

  const pager =
    pages > 1
      ? `<div class="pager-nums">
${cur > 1 ? `<a href="${adminBase}${qstring({ q, sort, page: cur - 1 })}">← Назад</a>` : `<span class="off">← Назад</span>`}
${Array.from({ length: pages }, (_, i) => i + 1)
  .map((p) =>
    p === cur
      ? `<span class="on">${p}</span>`
      : `<a href="${adminBase}${qstring({ q, sort, page: p })}">${p}</a>`,
  )
  .join("\n")}
${cur < pages ? `<a href="${adminBase}${qstring({ q, sort, page: cur + 1 })}">Вперёд →</a>` : `<span class="off">Вперёд →</span>`}
</div>`
      : "";

  return shell(
    "Заметки — управление",
    `<div class="admin-bar">
  <span class="crumbs">Заметки <span style="font-size:0.9rem;color:var(--ink-faint);font-family:var(--serif-text);">· всего ${total}</span></span>
  <span>
    <a class="btn" href="${adminBase}/new">Новая запись</a>
    <a class="btn btn--ghost" href="${BASE_PATH}/" target="_blank">Открыть стену</a>
    <form method="post" action="${adminBase}/logout" style="display:inline">
      <button class="btn btn--ghost" type="submit">Выйти</button>
    </form>
  </span>
</div>
${controls}
${rows}
${pager}`,
  );
}

export function editorView(post) {
  const isNew = !post;
  const data = {
    slug: post?.slug || "",
    title: post?.title || "",
    markdown: post?.markdown || "",
    published: post ? post.published : false,
  };
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return shell(
    isNew ? "Новая запись — Дневник" : `${post.title} — Дневник`,
    `<div class="admin-bar">
  <span class="crumbs"><a href="${BASE_PATH}/admin">Дневник</a> · ${isNew ? "новая запись" : "редактирование"}</span>
  <span><a class="btn btn--ghost" href="${BASE_PATH}/admin">← К списку</a></span>
</div>

<div class="field">
  <input type="text" id="title" placeholder="Заголовок записи" value="${escapeHtml(data.title)}">
</div>

<div class="editor-actions">
  <button class="btn" id="save">Сохранить</button>
  <label><input type="checkbox" id="published" ${data.published ? "checked" : ""}> Публичный</label>
  <span class="save-state" id="state"></span>
  ${isNew ? "" : `<button class="btn btn--danger" id="delete" type="button">Удалить</button>`}
</div>

<div class="editor-grid">
  <div>
    <div class="pane-label">Markdown</div>
    <div class="toolbar" id="toolbar">
      <button type="button" data-wrap="**" title="Жирный"><b>B</b></button>
      <button type="button" data-wrap="*" title="Курсив"><i>I</i></button>
      <button type="button" data-prefix="## " title="Заголовок">H</button>
      <button type="button" data-prefix="- " title="Список">•</button>
      <button type="button" data-prefix="> " title="Цитата">&ldquo;</button>
      <button type="button" data-link="1" title="Ссылка">↗</button>
    </div>
    <textarea id="md" placeholder="Пишите здесь. Поддерживается Markdown.">${escapeHtml(data.markdown)}</textarea>
  </div>
  <div>
    <div class="pane-label">Превью</div>
    <div class="preview-pane"><div class="prose" id="preview"></div></div>
  </div>
</div>

<script>
const BASE = ${JSON.stringify(BASE_PATH)};
const initial = ${json};
let slug = initial.slug;
const $ = (id) => document.getElementById(id);
const md = $("md"), title = $("title"), state = $("state");

function setState(t){ state.textContent = t; }

let t;
async function preview(){
  try {
    const r = await fetch(BASE + "/api/preview", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ markdown: md.value })
    });
    const { html } = await r.json();
    $("preview").innerHTML = html;
  } catch(e){ /* ignore preview errors */ }
}
function schedulePreview(){ clearTimeout(t); t = setTimeout(preview, 250); }
md.addEventListener("input", schedulePreview);
preview();

// toolbar
$("toolbar").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if(!b) return;
  const start = md.selectionStart, end = md.selectionEnd;
  const sel = md.value.slice(start, end);
  let insert = sel, caret = null;
  if (b.dataset.wrap){ const w=b.dataset.wrap; insert = w+(sel||"текст")+w; }
  else if (b.dataset.prefix){ insert = b.dataset.prefix+(sel||""); }
  else if (b.dataset.link){ const url=prompt("URL ссылки:","https://"); if(url===null) return; insert="["+(sel||"текст")+"]("+url+")"; }
  md.setRangeText(insert, start, end, "end");
  md.focus(); schedulePreview();
});

async function save(){
  setState("Сохранение…");
  const r = await fetch(BASE + "/api/posts", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ slug, title: title.value, markdown: md.value, published: $("published").checked })
  });
  if(!r.ok){ setState("Ошибка сохранения"); return; }
  const data = await r.json();
  slug = data.slug;
  setState("Сохранено · " + new Date().toLocaleTimeString("ru-RU"));
  if (history.replaceState) history.replaceState(null,"", BASE + "/admin/edit/" + slug);
}
$("save").addEventListener("click", save);
document.addEventListener("keydown",(e)=>{ if((e.metaKey||e.ctrlKey)&&e.key==="s"){ e.preventDefault(); save(); }});

const del = $("delete");
if (del) del.addEventListener("click", async () => {
  if(!confirm("Удалить запись безвозвратно?")) return;
  const r = await fetch(BASE + "/api/posts/" + slug + "/delete", { method:"POST" });
  if(r.ok) location.href = BASE + "/admin";
});
</script>`,
  );
}

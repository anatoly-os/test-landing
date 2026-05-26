import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { POSTS_DIR } from "./config.js";

const TRANSLIT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

export function slugify(input) {
  const base = String(input || "")
    .toLowerCase()
    .split("")
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "post";
}

function postPath(slug) {
  return path.join(POSTS_DIR, `${slug}.md`);
}

export function postExists(slug) {
  return fs.existsSync(postPath(slug));
}

export function uniqueSlug(desired, currentSlug = null) {
  let slug = slugify(desired);
  if (slug === currentSlug) return slug;
  let candidate = slug;
  let n = 2;
  while (postExists(candidate) && candidate !== currentSlug) {
    candidate = `${slug}-${n++}`;
  }
  return candidate;
}

export function readPost(slug) {
  const file = postPath(slug);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  const { data, content } = matter(raw);
  return {
    slug,
    title: data.title || "Без заголовка",
    date: data.date || null,
    updated: data.updated || null,
    published: data.published !== false,
    markdown: content.trim(),
  };
}

export function listPosts({ publishedOnly = false } = {}) {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => readPost(f.replace(/\.md$/, "")))
    .filter(Boolean)
    .filter((p) => (publishedOnly ? p.published : true))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

export function savePost({ slug, title, markdown, published, date }) {
  const finalSlug = slug || uniqueSlug(title);
  const now = new Date().toISOString();
  const existing = postExists(finalSlug) ? readPost(finalSlug) : null;
  const frontmatter = {
    title: title || "Без заголовка",
    date: date || existing?.date || now,
    updated: now,
    published: Boolean(published),
  };
  const file = matter.stringify(`\n${(markdown || "").trim()}\n`, frontmatter);
  fs.writeFileSync(postPath(finalSlug), file, "utf8");
  return readPost(finalSlug);
}

export function deletePost(slug) {
  const file = postPath(slug);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

// Search (substring in title + body), sort (date asc/desc) and paginate.
export function queryPosts({
  publishedOnly = false,
  q = "",
  sort = "desc",
  page = 1,
  pageSize = 10,
} = {}) {
  let items = listPosts({ publishedOnly }); // listPosts is date-descending
  const needle = String(q || "").trim().toLowerCase();
  if (needle) {
    items = items.filter((p) =>
      `${p.title}\n${p.markdown}`.toLowerCase().includes(needle),
    );
  }
  if (sort === "asc") items = items.slice().reverse();

  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(Math.max(1, Number(page) || 1), pages);
  const start = (cur - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page: cur,
    pages,
    sort: sort === "asc" ? "asc" : "desc",
    q: String(q || ""),
  };
}

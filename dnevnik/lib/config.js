import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Load .env if present (Node >= 20.12 has process.loadEnvFile).
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

export const ROOT = root;
export const PORT = Number(process.env.PORT || 4321);

// Where markdown sources live.
export const POSTS_DIR = process.env.POSTS_DIR
  ? path.resolve(process.env.POSTS_DIR)
  : path.join(root, "posts");

// Where generated static files (public index + post pages) are written.
// In production this points at the nginx webroot subfolder, e.g.
// /var/www/osokin.ai/dnevnik
export const PUBLIC_DIR = process.env.PUBLIC_DIR
  ? path.resolve(process.env.PUBLIC_DIR)
  : path.join(root, "public");

// Mount path the blog is served under (must match nginx location).
export const BASE_PATH = process.env.BASE_PATH || "/dnevnik";

// URL of the shared site stylesheet (book aesthetic). Served by nginx in prod.
export const SITE_CSS = process.env.SITE_CSS || "/manifest/style.css";

// Auth.
export const SESSION_SECRET =
  process.env.SESSION_SECRET || "dev-insecure-secret-change-me";
export const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

// Dev-only fallback so the app is usable immediately on localhost.
export const IS_DEV = !process.env.NODE_ENV || process.env.NODE_ENV === "development";

for (const dir of [POSTS_DIR, PUBLIC_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

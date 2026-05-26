import crypto from "node:crypto";
import {
  SESSION_SECRET,
  ADMIN_PASSWORD_HASH,
  ADMIN_PASSWORD,
  IS_DEV,
} from "./config.js";

const SCRYPT_KEYLEN = 64;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days
const COOKIE_NAME = "dnevnik_sid";

// --- password hashing (scrypt, no external deps) ---------------------------

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${derived}`;
}

function verifyAgainstHash(password, stored) {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const keyBuf = Buffer.from(key, "hex");
  return (
    keyBuf.length === derived.length &&
    crypto.timingSafeEqual(keyBuf, derived)
  );
}

// Resolve the configured password hash. In production set ADMIN_PASSWORD_HASH.
// For local dev convenience, a plain ADMIN_PASSWORD is hashed at startup.
let resolvedHash = ADMIN_PASSWORD_HASH;
if (!resolvedHash && ADMIN_PASSWORD) {
  resolvedHash = hashPassword(ADMIN_PASSWORD);
}
if (!resolvedHash && IS_DEV) {
  // Last-resort dev default so localhost is usable out of the box.
  resolvedHash = hashPassword("dev");
  // eslint-disable-next-line no-console
  console.warn(
    '[dnevnik] No ADMIN_PASSWORD set — using dev password "dev". Do NOT use in production.',
  );
}

export function passwordConfigured() {
  return Boolean(resolvedHash);
}

export function checkPassword(password) {
  if (!resolvedHash) return false;
  return verifyAgainstHash(password, resolvedHash);
}

// --- signed session cookie --------------------------------------------------

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function makeToken() {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_TTL_MS });
  const body = Buffer.from(payload).toString("base64url");
  return `${body}.${sign(body)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string") return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

export function startSession(res) {
  res.cookie(COOKIE_NAME, makeToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: !IS_DEV,
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export function endSession(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function isAuthed(req) {
  return verifyToken(req.cookies?.[COOKIE_NAME]);
}

export function requireAuth(loginUrl) {
  return (req, res, next) => {
    if (isAuthed(req)) return next();
    if (req.accepts("html")) return res.redirect(loginUrl);
    return res.status(401).json({ error: "unauthorized" });
  };
}

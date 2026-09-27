import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { db } from "./db.js";

const cookieName = "pingward_session";
const hashToken = (token) => createHash("sha256").update(token).digest("hex");

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return (
    actual.length === expectedBuffer.length &&
    timingSafeEqual(actual, expectedBuffer)
  );
}

export function createSession(res, req, adminId) {
  const token = randomBytes(32).toString("hex");
  const expires = Date.now() + 30 * 86400000;
  db.prepare(
    "INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)",
  ).run(hashToken(token), adminId, expires);
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: req.secure,
    sameSite: "lax",
    path: "/",
    expires: new Date(expires),
  });
}

export function sessionToken(req) {
  const raw = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  return raw?.slice(cookieName.length + 1) || "";
}

export function currentAdmin(req) {
  const token = sessionToken(req);
  if (!token) return null;
  return (
    db
      .prepare(
        `SELECT admins.id, admins.email FROM sessions JOIN admins ON admins.id = sessions.admin_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
      )
      .get(hashToken(token), Date.now()) || null
  );
}

export function requireAdmin(req, res, next) {
  req.admin = currentAdmin(req);
  if (!req.admin) return res.status(401).json({ error: "Please sign in." });
  next();
}

export function destroySession(req, res) {
  const token = sessionToken(req);
  if (token)
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
      hashToken(token),
    );
  res.clearCookie(cookieName, { path: "/" });
}

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const dataDir = process.env.DATA_DIR || "./data";
mkdirSync(dataDir, { recursive: true });
export const db = new DatabaseSync(join(dataDir, "pingward.sqlite"));
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  custom_domain TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS groups_custom_domain ON groups (custom_domain) WHERE custom_domain <> '';
CREATE TABLE IF NOT EXISTS monitors (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'http',
  target TEXT NOT NULL,
  port INTEGER,
  interval_seconds INTEGER NOT NULL DEFAULT 60,
  timeout_seconds INTEGER NOT NULL DEFAULT 10,
  expected_status INTEGER NOT NULL DEFAULT 200,
  active INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  last_checked_at TEXT,
  last_response_ms INTEGER,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS group_monitors (
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, monitor_id)
);
CREATE TABLE IF NOT EXISTS checks (
  id INTEGER PRIMARY KEY,
  monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  checked_at TEXT NOT NULL,
  status TEXT NOT NULL,
  response_ms INTEGER,
  error TEXT
);
CREATE INDEX IF NOT EXISTS checks_monitor_time ON checks (monitor_id, checked_at DESC);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'info',
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

const defaults = {
  site_name: "Pingward",
  site_description: "A clear view of every service.",
  theme: "light",
  layout: "grid",
  bar_style: "bars",
  public_url: "",
  smtp_host: "",
  smtp_port: "587",
  smtp_user: "",
  smtp_password: "",
  smtp_from: "",
  smtp_to: "",
  smtp_secure: "false",
};
const insertDefault = db.prepare(
  "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
);
for (const [key, value] of Object.entries(defaults))
  insertDefault.run(key, value);

export function settings(includeSecrets = false) {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const result = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  if (!includeSecrets) delete result.smtp_password;
  return result;
}

export function monitorRows() {
  const rows = db.prepare("SELECT * FROM monitors ORDER BY id DESC").all();
  const memberships = db
    .prepare("SELECT group_id, monitor_id FROM group_monitors")
    .all();
  return rows.map((row) => ({
    ...row,
    active: Boolean(row.active),
    group_ids: memberships
      .filter((item) => item.monitor_id === row.id)
      .map((item) => item.group_id),
  }));
}

export function groupRows() {
  return db.prepare("SELECT * FROM groups ORDER BY sort_order, id").all();
}

export function eventRows(publishedOnly = false) {
  const rows = db
    .prepare(
      `SELECT * FROM events ${publishedOnly ? "WHERE published = 1" : ""} ORDER BY created_at DESC, id DESC LIMIT 50`,
    )
    .all();
  return rows.map((row) => ({ ...row, published: Boolean(row.published) }));
}

export function historyFor(monitorId, days = 90) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  return db
    .prepare(
      `SELECT substr(checked_at, 1, 10) AS day,
    COUNT(*) AS total,
    SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) AS up,
    AVG(CASE WHEN status = 'up' THEN response_ms ELSE NULL END) AS response_ms
    FROM checks WHERE monitor_id = ? AND checked_at >= ? GROUP BY day ORDER BY day`,
    )
    .all(monitorId, since);
}

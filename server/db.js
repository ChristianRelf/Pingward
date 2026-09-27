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
  website_url TEXT NOT NULL DEFAULT '',
  custom_domain TEXT NOT NULL DEFAULT '',
  display_mode TEXT NOT NULL DEFAULT 'inline',
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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  logo_preset TEXT NOT NULL DEFAULT 'activity',
  logo_mime TEXT,
  logo_data BLOB,
  logo_updated_at INTEGER NOT NULL DEFAULT 0
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
CREATE TABLE IF NOT EXISTS branding_assets (
  key TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  updated_at INTEGER NOT NULL
);
`);

const monitorColumns = new Set(
  db
    .prepare("PRAGMA table_info(monitors)")
    .all()
    .map((column) => column.name),
);
for (const [name, definition] of Object.entries({
  logo_preset: "TEXT NOT NULL DEFAULT 'activity'",
  logo_mime: "TEXT",
  logo_data: "BLOB",
  logo_updated_at: "INTEGER NOT NULL DEFAULT 0",
})) {
  if (!monitorColumns.has(name))
    db.exec(`ALTER TABLE monitors ADD COLUMN ${name} ${definition}`);
}

const groupColumns = new Set(
  db
    .prepare("PRAGMA table_info(groups)")
    .all()
    .map((column) => column.name),
);
if (!groupColumns.has("display_mode"))
  db.exec(
    "ALTER TABLE groups ADD COLUMN display_mode TEXT NOT NULL DEFAULT 'page'",
  );
if (!groupColumns.has("website_url"))
  db.exec("ALTER TABLE groups ADD COLUMN website_url TEXT NOT NULL DEFAULT ''");

const defaults = {
  site_name: "Pingward",
  site_description: "A clear view of every service.",
  theme: "dark",
  layout: "list",
  bar_style: "bars",
  accent_color: "#21ab75",
  brand_icon: "activity",
  page_width: "standard",
  density: "comfortable",
  corner_style: "rounded",
  show_admin_link: "true",
  show_response_time: "true",
  footer_text: "Transparent status for every service.",
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

// Adopt the new default on existing instances that still use the original
// appearance. Leave customized public pages alone, and run this only once so
// an administrator can choose Light later without it being changed again.
if (db.prepare("PRAGMA user_version").get().user_version === 0) {
  const current = Object.fromEntries(
    db
      .prepare("SELECT key, value FROM settings")
      .all()
      .map((row) => [row.key, row.value]),
  );
  if (
    current.theme === "light" &&
    [
      "site_name",
      "site_description",
      "layout",
      "bar_style",
      "public_url",
    ].every(
      (key) => current[key] === (key === "layout" ? "grid" : defaults[key]),
    )
  ) {
    db.prepare("UPDATE settings SET value = 'dark' WHERE key = 'theme'").run();
  }
  db.exec("PRAGMA user_version = 1");
}

export function settings(includeSecrets = false) {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const result = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  if (!includeSecrets) delete result.smtp_password;
  return result;
}

export function monitorRows() {
  const rows = db
    .prepare(
      `SELECT id, name, type, target, port, interval_seconds, timeout_seconds, expected_status,
      active, status, last_checked_at, last_response_ms, last_error, created_at,
      logo_preset, logo_updated_at, logo_data IS NOT NULL AS has_logo
      FROM monitors ORDER BY id DESC`,
    )
    .all();
  const memberships = db
    .prepare("SELECT group_id, monitor_id FROM group_monitors")
    .all();
  return rows.map((row) => ({
    ...row,
    active: Boolean(row.active),
    has_logo: Boolean(row.has_logo),
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

export function brandingAsset(key) {
  return db
    .prepare("SELECT mime, data, updated_at FROM branding_assets WHERE key = ?")
    .get(key);
}

export function brandingSummary() {
  const rows = db.prepare("SELECT key, updated_at FROM branding_assets").all();
  return {
    has_og_image: rows.some((row) => row.key === "og_image"),
    has_favicon: rows.some((row) => row.key === "favicon"),
    og_image_updated_at:
      rows.find((row) => row.key === "og_image")?.updated_at || 0,
    favicon_updated_at:
      rows.find((row) => row.key === "favicon")?.updated_at || 0,
  };
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

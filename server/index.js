import express from "express";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import {
  db,
  settings,
  monitorRows,
  groupRows,
  eventRows,
  historyFor,
} from "./db.js";
import {
  hashPassword,
  verifyPassword,
  createSession,
  currentAdmin,
  requireAdmin,
  destroySession,
} from "./auth.js";
import { validateMonitor, runCheck, startScheduler } from "./checker.js";
import { listenOnAvailablePort } from "./port.js";
import { monitorLogoInput } from "./monitor-logo.js";

export const app = express();
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers.origin) {
    const expected = `${req.protocol}://${req.get("host")}`;
    if (req.headers.origin !== expected)
      return res.status(403).json({ error: "Request origin is not allowed." });
  }
  next();
});
app.use("/api/admin/monitors", requireAdmin, express.json({ limit: "1mb" }));
app.use(express.json({ limit: "64kb" }));

const text = (value, max = 500) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
const idFrom = (value) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Invalid ID.");
  return id;
};
function notFound(res) {
  return res.status(404).json({ error: "Not found." });
}
function saveMemberships(monitorId, groupIds) {
  const insert = db.prepare(
    "INSERT INTO group_monitors (group_id, monitor_id) VALUES (?, ?)",
  );
  db.prepare("DELETE FROM group_monitors WHERE monitor_id = ?").run(monitorId);
  for (const groupId of groupIds) insert.run(groupId, monitorId);
}
function publicMonitor(row) {
  const history = historyFor(row.id);
  const total = history.reduce((sum, item) => sum + item.total, 0);
  const up = history.reduce((sum, item) => sum + item.up, 0);
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    last_checked_at: row.last_checked_at,
    last_response_ms: row.last_response_ms,
    group_ids: row.group_ids,
    logo_preset: row.logo_preset,
    has_logo: row.has_logo,
    logo_updated_at: row.logo_updated_at,
    history,
    uptime: total ? Number(((up / total) * 100).toFixed(2)) : null,
  };
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/bootstrap", (req, res) => {
  const admin = currentAdmin(req);
  res.json({
    needs_setup: !db.prepare("SELECT id FROM admins LIMIT 1").get(),
    requires_setup_token: Boolean(process.env.SETUP_TOKEN),
    admin,
  });
});
app.get("/api/monitor-logos/:id", (req, res) => {
  const logo = db
    .prepare("SELECT active, logo_mime, logo_data FROM monitors WHERE id = ?")
    .get(idFrom(req.params.id));
  if (!logo?.logo_data || (!logo.active && !currentAdmin(req)))
    return notFound(res);
  res.set("X-Content-Type-Options", "nosniff");
  res.type(logo.logo_mime).send(Buffer.from(logo.logo_data));
});
app.post("/api/setup", (req, res) => {
  if (db.prepare("SELECT id FROM admins LIMIT 1").get())
    return res.status(409).json({ error: "Setup is already complete." });
  if (process.env.SETUP_TOKEN) {
    const actual = Buffer.from(String(req.body.setup_token || ""));
    const expected = Buffer.from(process.env.SETUP_TOKEN);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return res.status(403).json({ error: "Incorrect setup token." });
  }
  const email = text(req.body.email, 254).toLowerCase();
  const password = String(req.body.password || "");
  if (!/^\S+@\S+\.\S+$/.test(email))
    return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 12)
    return res
      .status(400)
      .json({ error: "Use a password of at least 12 characters." });
  const result = db
    .prepare("INSERT INTO admins (email, password_hash) VALUES (?, ?)")
    .run(email, hashPassword(password));
  createSession(res, req, Number(result.lastInsertRowid));
  res
    .status(201)
    .json({ admin: { id: Number(result.lastInsertRowid), email } });
});

const attempts = new Map();
app.post("/api/login", (req, res) => {
  const key = req.ip;
  const entry = attempts.get(key) || { count: 0, until: 0 };
  if (entry.until > Date.now())
    return res
      .status(429)
      .json({ error: "Too many attempts. Try again in 15 minutes." });
  const email = text(req.body.email, 254).toLowerCase();
  const admin = db.prepare("SELECT * FROM admins WHERE email = ?").get(email);
  if (
    !admin ||
    !verifyPassword(String(req.body.password || ""), admin.password_hash)
  ) {
    entry.count += 1;
    if (entry.count >= 10) {
      entry.until = Date.now() + 15 * 60000;
      entry.count = 0;
    }
    attempts.set(key, entry);
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  attempts.delete(key);
  createSession(res, req, admin.id);
  res.json({ admin: { id: admin.id, email: admin.email } });
});
app.post("/api/logout", (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

app.get("/api/public", (req, res) => {
  const allGroups = groupRows();
  const domainGroup = allGroups.find(
    (group) =>
      group.custom_domain &&
      group.custom_domain.toLowerCase() === req.hostname.toLowerCase(),
  );
  const slug = text(req.query.group, 100);
  const selectedGroup =
    domainGroup ||
    (slug ? allGroups.find((group) => group.slug === slug) : null);
  if (slug && !selectedGroup) return notFound(res);
  const visibleGroups = domainGroup ? [domainGroup] : allGroups;
  const monitors = monitorRows().filter(
    (row) =>
      row.active &&
      (!selectedGroup || row.group_ids.includes(selectedGroup.id)),
  );
  const visibleEvents = eventRows(true).filter(
    (event) =>
      !selectedGroup ||
      event.group_id === null ||
      event.group_id === selectedGroup.id,
  );
  const publicSettings = settings();
  res.json({
    settings: {
      site_name: publicSettings.site_name,
      site_description: publicSettings.site_description,
      theme: publicSettings.theme,
      layout: publicSettings.layout,
      bar_style: publicSettings.bar_style,
      public_url: publicSettings.public_url,
    },
    groups: visibleGroups,
    selected_group: selectedGroup?.id || null,
    monitors: monitors.map(publicMonitor),
    events: visibleEvents,
  });
});

app.use("/api/admin", requireAdmin);
app.get("/api/admin/data", (_req, res) => {
  res.json({
    settings: settings(),
    groups: groupRows(),
    monitors: monitorRows().map((row) => ({
      ...row,
      history: historyFor(row.id),
    })),
    events: eventRows(),
  });
});

app.post("/api/admin/monitors", (req, res) => {
  const data = validateMonitor(req.body);
  const logo = monitorLogoInput(req.body);
  const result = db
    .prepare(
      `INSERT INTO monitors (name, type, target, port, interval_seconds, timeout_seconds, expected_status,
      active, logo_preset, logo_mime, logo_data, logo_updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.name,
      data.type,
      data.target,
      data.port,
      data.interval,
      data.timeout,
      data.expected,
      data.active,
      logo.preset,
      logo.mime,
      logo.data,
      logo.updatedAt,
    );
  const id = Number(result.lastInsertRowid);
  saveMemberships(id, data.groupIds);
  const row = db.prepare("SELECT * FROM monitors WHERE id = ?").get(id);
  if (data.active) void runCheck(row);
  res.status(201).json({ id });
});
app.put("/api/admin/monitors/:id", (req, res) => {
  const id = idFrom(req.params.id);
  const old = db.prepare("SELECT * FROM monitors WHERE id = ?").get(id);
  if (!old) return notFound(res);
  const data = validateMonitor(req.body);
  const logo = monitorLogoInput(req.body, old);
  const changed =
    old.target !== data.target ||
    old.type !== data.type ||
    old.port !== data.port ||
    old.expected_status !== data.expected;
  if (changed) db.prepare("DELETE FROM checks WHERE monitor_id = ?").run(id);
  db.prepare(
    `UPDATE monitors SET name = ?, type = ?, target = ?, port = ?, interval_seconds = ?, timeout_seconds = ?,
    expected_status = ?, active = ?, status = ?, last_checked_at = ?, last_response_ms = ?, last_error = ?,
    logo_preset = ?, logo_mime = ?, logo_data = ?, logo_updated_at = ? WHERE id = ?`,
  ).run(
    data.name,
    data.type,
    data.target,
    data.port,
    data.interval,
    data.timeout,
    data.expected,
    data.active,
    changed ? "pending" : old.status,
    changed ? null : old.last_checked_at,
    changed ? null : old.last_response_ms,
    changed ? null : old.last_error,
    logo.preset,
    logo.mime,
    logo.data,
    logo.updatedAt,
    id,
  );
  saveMemberships(id, data.groupIds);
  if (data.active && (changed || !old.active))
    void runCheck(db.prepare("SELECT * FROM monitors WHERE id = ?").get(id));
  res.json({ ok: true });
});
app.delete("/api/admin/monitors/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM monitors WHERE id = ?")
    .run(idFrom(req.params.id));
  if (!result.changes) return notFound(res);
  res.json({ ok: true });
});
app.post("/api/admin/monitors/:id/check", async (req, res) => {
  const monitor = db
    .prepare("SELECT * FROM monitors WHERE id = ?")
    .get(idFrom(req.params.id));
  if (!monitor) return notFound(res);
  res.json((await runCheck(monitor)) || { busy: true });
});

function groupInput(body, old = null) {
  const name = text(body.name, 100);
  const slug = text(body.slug, 100).toLowerCase();
  const description = text(body.description, 500);
  const customDomain = text(body.custom_domain, 253)
    .toLowerCase()
    .replace(/\.$/, "");
  const displayMode = body.display_mode || old?.display_mode || "inline";
  if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new Error(
      "Enter a name and a lowercase slug using letters, numbers and hyphens.",
    );
  if (
    customDomain &&
    !/^(?=.{1,253}$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(customDomain)
  )
    throw new Error("Enter a domain without a protocol or path.");
  if (!["inline", "page"].includes(displayMode))
    throw new Error("Choose where this group appears.");
  return { name, slug, description, customDomain, displayMode };
}
app.post("/api/admin/groups", (req, res) => {
  const data = groupInput(req.body);
  const result = db
    .prepare(
      "INSERT INTO groups (name, slug, description, custom_domain, display_mode) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      data.name,
      data.slug,
      data.description,
      data.customDomain,
      data.displayMode,
    );
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});
app.put("/api/admin/groups/:id", (req, res) => {
  const id = idFrom(req.params.id);
  const old = db.prepare("SELECT * FROM groups WHERE id = ?").get(id);
  if (!old) return notFound(res);
  const data = groupInput(req.body, old);
  const result = db
    .prepare(
      "UPDATE groups SET name = ?, slug = ?, description = ?, custom_domain = ?, display_mode = ? WHERE id = ?",
    )
    .run(
      data.name,
      data.slug,
      data.description,
      data.customDomain,
      data.displayMode,
      id,
    );
  if (!result.changes) return notFound(res);
  res.json({ ok: true });
});
app.delete("/api/admin/groups/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM groups WHERE id = ?")
    .run(idFrom(req.params.id));
  if (!result.changes) return notFound(res);
  res.json({ ok: true });
});

function eventInput(body) {
  const title = text(body.title, 150);
  if (!title) throw new Error("Enter an event title.");
  const kind = ["info", "maintenance", "incident", "resolved"].includes(
    body.kind,
  )
    ? body.kind
    : "info";
  const groupId = body.group_id ? idFrom(body.group_id) : null;
  return {
    title,
    body: text(body.body, 5000),
    kind,
    groupId,
    published: body.published === false ? 0 : 1,
  };
}
app.post("/api/admin/events", (req, res) => {
  const item = eventInput(req.body);
  const result = db
    .prepare(
      "INSERT INTO events (title, body, kind, group_id, published) VALUES (?, ?, ?, ?, ?)",
    )
    .run(item.title, item.body, item.kind, item.groupId, item.published);
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});
app.put("/api/admin/events/:id", (req, res) => {
  const item = eventInput(req.body);
  const result = db
    .prepare(
      "UPDATE events SET title = ?, body = ?, kind = ?, group_id = ?, published = ? WHERE id = ?",
    )
    .run(
      item.title,
      item.body,
      item.kind,
      item.groupId,
      item.published,
      idFrom(req.params.id),
    );
  if (!result.changes) return notFound(res);
  res.json({ ok: true });
});
app.delete("/api/admin/events/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM events WHERE id = ?")
    .run(idFrom(req.params.id));
  if (!result.changes) return notFound(res);
  res.json({ ok: true });
});

const settingKeys = [
  "site_name",
  "site_description",
  "theme",
  "layout",
  "bar_style",
  "public_url",
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_from",
  "smtp_to",
  "smtp_secure",
];
app.put("/api/admin/settings", (req, res) => {
  const values = {};
  for (const key of settingKeys)
    values[key] = text(req.body[key], key === "site_description" ? 500 : 300);
  if (!values.site_name) throw new Error("Enter a site name.");
  if (!["light", "dark", "system"].includes(values.theme))
    throw new Error("Choose a valid theme.");
  if (!["grid", "list"].includes(values.layout))
    throw new Error("Choose a valid layout.");
  if (!["bars", "heatmap"].includes(values.bar_style))
    throw new Error("Choose a valid uptime style.");
  if (values.public_url && !/^https?:\/\//.test(values.public_url))
    throw new Error("Public URL must start with http:// or https://.");
  if (
    values.smtp_port &&
    (!Number.isInteger(Number(values.smtp_port)) ||
      Number(values.smtp_port) < 1 ||
      Number(values.smtp_port) > 65535)
  )
    throw new Error("Invalid SMTP port.");
  values.smtp_secure = values.smtp_secure === "true" ? "true" : "false";
  if (req.body.smtp_password_clear) values.smtp_password = "";
  else if (req.body.smtp_password)
    values.smtp_password = String(req.body.smtp_password).slice(0, 500);
  const update = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  for (const [key, value] of Object.entries(values)) update.run(key, value);
  res.json({ settings: settings() });
});
app.post("/api/admin/smtp/test", async (_req, res) => {
  const config = settings(true);
  if (!config.smtp_host || !config.smtp_to || !config.smtp_from)
    throw new Error("Save SMTP host, From and To addresses first.");
  const transport = nodemailer.createTransport({
    host: config.smtp_host,
    port: Number(config.smtp_port) || 587,
    secure: config.smtp_secure === "true",
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    auth: config.smtp_user
      ? { user: config.smtp_user, pass: config.smtp_password }
      : undefined,
  });
  await transport.sendMail({
    from: config.smtp_from,
    to: config.smtp_to,
    subject: `[${config.site_name}] Test alert`,
    text: "Your Pingward SMTP settings are working.",
  });
  res.json({ ok: true });
});
app.put("/api/admin/password", (req, res) => {
  const admin = db
    .prepare("SELECT * FROM admins WHERE id = ?")
    .get(req.admin.id);
  if (
    !verifyPassword(
      String(req.body.current_password || ""),
      admin.password_hash,
    )
  )
    return res.status(400).json({ error: "Current password is incorrect." });
  const next = String(req.body.new_password || "");
  if (next.length < 12)
    throw new Error("Use a password of at least 12 characters.");
  db.prepare("UPDATE admins SET password_hash = ? WHERE id = ?").run(
    hashPassword(next),
    admin.id,
  );
  db.prepare("DELETE FROM sessions WHERE admin_id = ?").run(admin.id);
  destroySession(req, res);
  res.json({ ok: true });
});

app.use("/api", (_req, res) => notFound(res));
app.use((error, _req, res, _next) => {
  const message = error.message || "Unexpected error.";
  const status =
    error.code?.startsWith("SQLITE_CONSTRAINT") ||
    (error.code === "ERR_SQLITE_ERROR" && /constraint failed/i.test(message))
      ? 409
      : error instanceof TypeError
        ? 500
        : 400;
  if (status === 500) console.error(error);
  res.status(status).json({
    error:
      status === 409
        ? "That name, slug or domain is already in use, or a selected group does not exist."
        : message,
  });
});

const dist = resolve("dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.use((_req, res) => res.sendFile(join(dist, "index.html")));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  listenOnAvailablePort(
    app,
    process.env.PORT || 3000,
    process.env.STRICT_PORT === "1",
  )
    .then(({ port }) => {
      startScheduler();
      console.log(`Pingward listening on http://0.0.0.0:${port}`);
    })
    .catch((error) => {
      console.error("Pingward could not start:", error.message);
      process.exitCode = 1;
    });
}

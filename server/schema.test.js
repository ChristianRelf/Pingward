import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

test("existing groups and monitors gain display and logo defaults", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "pingward-schema-"));
  try {
    const db = new DatabaseSync(join(dataDir, "pingward.sqlite"));
    db.exec(`
      CREATE TABLE groups (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '', custom_domain TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE monitors (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'http',
        target TEXT NOT NULL, port INTEGER, interval_seconds INTEGER NOT NULL DEFAULT 60,
        timeout_seconds INTEGER NOT NULL DEFAULT 10, expected_status INTEGER NOT NULL DEFAULT 200,
        active INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'pending',
        last_checked_at TEXT, last_response_ms INTEGER, last_error TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO groups (name, slug) VALUES ('Legacy group', 'legacy-group');
      INSERT INTO monitors (name, target) VALUES ('Legacy monitor', 'https://example.com');
    `);
    db.close();

    const dbModule = pathToFileURL(resolve("server/db.js")).href;
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { groupRows, monitorRows, brandingSummary } from ${JSON.stringify(dbModule)}; console.log(JSON.stringify({ group: groupRows()[0], monitor: monitorRows()[0], branding: brandingSummary() }));`,
      ],
      { env: { ...process.env, DATA_DIR: dataDir }, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const { group, monitor, branding } = JSON.parse(result.stdout);
    assert.equal(group.display_mode, "page");
    assert.equal(group.website_url, "");
    assert.equal(monitor.logo_preset, "activity");
    assert.equal(monitor.has_logo, false);
    assert.equal(monitor.logo_updated_at, 0);
    assert.equal(branding.has_og_image, false);
    assert.equal(branding.has_favicon, false);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const dbModule = pathToFileURL(resolve("server/db.js")).href;

function readTheme(dataDir) {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { settings } from ${JSON.stringify(dbModule)}; console.log(settings().theme);`,
    ],
    { env: { ...process.env, DATA_DIR: dataDir }, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function legacyDatabase(dataDir, siteName) {
  const db = new DatabaseSync(join(dataDir, "pingward.sqlite"));
  db.exec("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  const put = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
  for (const [key, value] of Object.entries({
    site_name: siteName,
    site_description: "A clear view of every service.",
    theme: "light",
    layout: "grid",
    bar_style: "bars",
    public_url: "",
  }))
    put.run(key, value);
  db.close();
}

test("upgrades the untouched light default once and preserves custom themes", () => {
  const original = mkdtempSync(join(tmpdir(), "pingward-theme-default-"));
  const customized = mkdtempSync(join(tmpdir(), "pingward-theme-custom-"));
  try {
    legacyDatabase(original, "Pingward");
    assert.equal(readTheme(original), "dark");

    const db = new DatabaseSync(join(original, "pingward.sqlite"));
    db.prepare("UPDATE settings SET value = 'light' WHERE key = 'theme'").run();
    db.close();
    assert.equal(readTheme(original), "light");

    legacyDatabase(customized, "My status page");
    assert.equal(readTheme(customized), "light");
  } finally {
    rmSync(original, { recursive: true, force: true });
    rmSync(customized, { recursive: true, force: true });
  }
});

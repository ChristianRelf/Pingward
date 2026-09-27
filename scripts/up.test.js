import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  rmSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

test("Docker launcher advances through occupied host ports", () => {
  const root = mkdtempSync(join(tmpdir(), "pingward-launcher-"));
  try {
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, "bin"));
    copyFileSync(resolve("scripts/up.sh"), join(root, "scripts/up.sh"));
    const fakeDocker = join(root, "bin/docker");
    writeFileSync(
      fakeDocker,
      `#!/bin/sh
if [ "$2" = "build" ]; then exit 0; fi
if [ "$2" = "up" ] && [ "$PINGWARD_HOST_PORT" -lt 3002 ]; then
  echo "port is already allocated" >&2
  exit 1
fi
exit 0
`,
    );
    chmodSync(fakeDocker, 0o755);
    const result = spawnSync("bash", [join(root, "scripts/up.sh")], {
      env: {
        ...process.env,
        PATH: `${join(root, "bin")}:${process.env.PATH}`,
        PINGWARD_HOST_PORT: "3000",
      },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Port 3000 is in use; trying 3001/);
    assert.match(result.stdout, /Port 3001 is in use; trying 3002/);
    assert.match(result.stdout, /http:\/\/localhost:3002/);
    assert.equal(readFileSync(join(root, ".pingward-port"), "utf8"), "3002\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

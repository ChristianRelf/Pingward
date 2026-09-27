import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  statSync,
  rmSync,
  chmodSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "pingward-installer-"));
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, "bin"));
  copyFileSync(resolve("install.sh"), join(root, "install.sh"));
  copyFileSync(resolve("scripts/up.sh"), join(root, "scripts/up.sh"));
  const fakeDocker = join(root, "bin/docker");
  writeFileSync(
    fakeDocker,
    `#!/bin/sh
echo "$*" >> "$FAKE_DOCKER_LOG"
if [ "$1" = "info" ]; then exit 0; fi
if [ "$1" = "exec" ]; then
  case "$*" in *api/bootstrap*) echo setup ;; esac
  if [ "$FAKE_HEALTH_FAIL" = 1 ]; then exit 1; fi
  exit 0
fi
if [ "$1" = "compose" ]; then
  case "$2" in
    version|build) exit 0 ;;
    up)
      if [ "$PINGWARD_HOST_PORT" = 3000 ]; then
        echo 'port is already allocated' >&2
        exit 1
      fi
      echo 'Pingward container started'
      exit 0
      ;;
    ps) echo fake-container; exit 0 ;;
    logs) echo 'Fake container failed health check' >&2; exit 0 ;;
  esac
fi
exit 1
`,
  );
  chmodSync(fakeDocker, 0o755);
  return {
    root,
    run(args = [], extraEnv = {}) {
      return spawnSync("bash", [join(root, "install.sh"), ...args], {
        env: {
          ...process.env,
          SETUP_TOKEN: "",
          PINGWARD_HOST_PORT: "",
          PINGWARD_BIND_ADDRESS: "",
          FAKE_HEALTH_FAIL: "",
          PATH: `${join(root, "bin")}:${process.env.PATH}`,
          FAKE_DOCKER_LOG: join(root, "docker.log"),
          ...extraEnv,
        },
        encoding: "utf8",
      });
    },
    runLegacy(args = [], extraEnv = {}) {
      return spawnSync("bash", [join(root, "scripts/up.sh"), ...args], {
        env: {
          ...process.env,
          SETUP_TOKEN: "",
          PINGWARD_HOST_PORT: "",
          PINGWARD_BIND_ADDRESS: "",
          FAKE_HEALTH_FAIL: "",
          PATH: `${join(root, "bin")}:${process.env.PATH}`,
          FAKE_DOCKER_LOG: join(root, "docker.log"),
          ...extraEnv,
        },
        encoding: "utf8",
      });
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

test("installer secures setup, finds a free port, and preserves config on rerun", () => {
  const site = fixture();
  try {
    writeFileSync(
      join(site.root, ".env"),
      "TRUST_PROXY=1\nCUSTOM_VALUE=preserved\n",
    );
    const first = site.run(["--port", "3000", "--bind", "127.0.0.1"]);
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /Port 3000 is occupied; trying 3001/);
    assert.match(first.stdout, /Pingward is ready at http:\/\/localhost:3001/);
    assert.match(first.stdout, /Setup token: [a-f0-9]{48}/);

    const envPath = join(site.root, ".env");
    const config = readFileSync(envPath, "utf8");
    const token = config.match(/^SETUP_TOKEN=([a-f0-9]{48})$/m)?.[1];
    assert.ok(token);
    assert.match(config, /^TRUST_PROXY=1$/m);
    assert.match(config, /^CUSTOM_VALUE=preserved$/m);
    assert.match(config, /^PINGWARD_HOST_PORT=3001$/m);
    assert.match(config, /^PINGWARD_BIND_ADDRESS=127\.0\.0\.1$/m);
    assert.equal(statSync(envPath).mode & 0o777, 0o600);
    assert.equal(
      readFileSync(join(site.root, ".pingward-port"), "utf8"),
      "3001\n",
    );

    const second = site.runLegacy(["--no-build"]);
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stdout, /Keeping the existing setup token/);
    assert.doesNotMatch(second.stdout, /Port 3000 is occupied/);
    assert.equal(
      readFileSync(envPath, "utf8").match(/^SETUP_TOKEN=/gm)?.length,
      1,
    );
    assert.match(
      readFileSync(envPath, "utf8"),
      new RegExp(`^SETUP_TOKEN=${token}$`, "m"),
    );
    assert.equal(
      readFileSync(join(site.root, "docker.log"), "utf8").match(
        /^compose build$/gm,
      )?.length,
      1,
    );
  } finally {
    site.cleanup();
  }
});

test("installer reports a failed health check without saving the selected port", () => {
  const site = fixture();
  try {
    const result = site.run(
      ["--port", "3001", "--timeout", "1", "--no-build"],
      { FAKE_HEALTH_FAIL: "1" },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /did not become ready/);
    assert.doesNotMatch(
      readFileSync(join(site.root, ".env"), "utf8"),
      /PINGWARD_HOST_PORT/,
    );
  } finally {
    site.cleanup();
  }
});

test("installer saves a supplied setup token for later launches", () => {
  const site = fixture();
  try {
    const result = site.run(["--port", "3001", "--no-build"], {
      SETUP_TOKEN: "supplied-token-123",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Saved the supplied setup token/);
    assert.match(
      readFileSync(join(site.root, ".env"), "utf8"),
      /^SETUP_TOKEN=supplied-token-123$/m,
    );
  } finally {
    site.cleanup();
  }
});

test("Git Bash installer hands off to PowerShell with mapped options", () => {
  const site = fixture();
  try {
    const bin = join(site.root, "bin");
    for (const [name, body] of Object.entries({
      uname: "printf 'MINGW64_NT-10.0\\n'",
      cygpath: "printf 'C:\\\\Pingward\\\\install.ps1\\n'",
      "powershell.exe": `printf '%s\\n' "$@" > "$FAKE_POWERSHELL_LOG"`,
    })) {
      const path = join(bin, name);
      writeFileSync(path, `#!/bin/sh\n${body}\n`);
      chmodSync(path, 0o755);
    }
    const result = site.run(["--port", "4000", "--no-build", "--yes"], {
      FAKE_POWERSHELL_LOG: join(site.root, "powershell.log"),
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Windows detected/);
    assert.deepEqual(
      readFileSync(join(site.root, "powershell.log"), "utf8")
        .trim()
        .split("\n"),
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        "C:\\Pingward\\install.ps1",
        "-Port",
        "4000",
        "-NoBuild",
        "-Yes",
      ],
    );
    assert.equal(existsSync(join(site.root, "docker.log")), false);

    const missingValue = site.run(["--port"]);
    assert.equal(missingValue.status, 1);
    assert.match(missingValue.stderr, /--port needs a value/);
  } finally {
    site.cleanup();
  }
});

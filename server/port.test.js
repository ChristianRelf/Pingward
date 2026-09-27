import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { listenOnAvailablePort } from "./port.js";

test("listens on the next available port when the requested port is occupied", async () => {
  const occupied = createServer((_req, res) => res.end("occupied"));
  await new Promise((resolve) => occupied.listen(0, "0.0.0.0", resolve));
  const requested = occupied.address().port;
  const app = {
    listen: (port, host) =>
      createServer((_req, res) => res.end("pingward")).listen(port, host),
  };
  let result;
  try {
    result = await listenOnAvailablePort(app, requested);
    assert.ok(result.port > requested);
    assert.equal(
      await (await fetch(`http://127.0.0.1:${result.port}`)).text(),
      "pingward",
    );
    await assert.rejects(listenOnAvailablePort(app, requested, true), {
      code: "EADDRINUSE",
    });
  } finally {
    result?.server.close();
    occupied.close();
  }
});

import { createServer as createViteServer } from "vite";
import { app } from "../server/index.js";
import { startScheduler } from "../server/checker.js";
import { listenOnAvailablePort } from "../server/port.js";

const { server, port } = await listenOnAvailablePort(
  app,
  process.env.PORT || 3000,
);
process.env.PINGWARD_API_PORT = String(port);
startScheduler();

const vite = await createViteServer({
  server: { proxy: { "/api": `http://127.0.0.1:${port}` } },
});

try {
  await vite.listen();
  console.log(`Pingward API listening on http://localhost:${port}`);
  vite.printUrls();
} catch (error) {
  server.close();
  throw error;
}

async function shutdown() {
  await vite.close();
  server.close();
  process.exit(0);
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

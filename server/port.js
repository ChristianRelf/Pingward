export async function listenOnAvailablePort(
  app,
  startPort = 3000,
  strict = false,
) {
  const start = Number(startPort);
  if (!Number.isInteger(start) || start < 1 || start > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535.");
  }

  for (let port = start; port <= 65535; port++) {
    try {
      const server = await new Promise((resolve, reject) => {
        const listener = app.listen(port, "0.0.0.0");
        const onListening = () => {
          listener.off("error", onError);
          resolve(listener);
        };
        const onError = (error) => {
          listener.off("listening", onListening);
          reject(error);
        };
        listener.once("listening", onListening);
        listener.once("error", onError);
      });
      return { server, port };
    } catch (error) {
      if (error.code !== "EADDRINUSE" || strict) throw error;
    }
  }
  throw new Error(`No available port found from ${start} through 65535.`);
}

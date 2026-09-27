import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiPort = process.env.PINGWARD_API_PORT || process.env.PORT || 3000;

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": `http://127.0.0.1:${apiPort}`,
      "/favicon": `http://127.0.0.1:${apiPort}`,
      "/og-image.png": `http://127.0.0.1:${apiPort}`,
    },
  },
});

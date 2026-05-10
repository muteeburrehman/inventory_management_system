import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const django =
    (env.VITE_PROXY_TARGET && env.VITE_PROXY_TARGET.trim()) || "http://127.0.0.1:8000";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: django,
          changeOrigin: true,
          configure(proxy) {
            proxy.on("error", (err) => {
              console.error(
                "[vite proxy /api → %s] %s — Is Django running on that host/port?",
                django,
                err.message,
              );
            });
          },
        },
        "/media": {
          target: django,
          changeOrigin: true,
        },
      },
    },
  };
});

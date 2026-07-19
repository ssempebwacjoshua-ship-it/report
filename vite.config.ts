import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/" : "/report-lab/",
  define: {
    __APP_BUILD_VERSION__: JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA
      || process.env.RAILWAY_GIT_COMMIT_SHA
      || process.env.SOURCE_VERSION
      || process.env.npm_package_version
      || "development",
    ),
    __APP_BUILD_TIME__: JSON.stringify(process.env.BUILD_TIME ?? null),
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
}));

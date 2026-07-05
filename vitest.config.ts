import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    globals: true,
    globalSetup: ["src/tests/globalSetup.ts"],
    setupFiles: ["src/tests/setup.ts"],
  },
});

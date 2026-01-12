// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  server: { port: 3000 },
  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        // Prevent Vite HMR/full reload loops during Playwright runs.
        // Playwright writes traces/screenshots/videos under these directories,
        // which would otherwise trigger file watcher events and reload the page mid-test.
        ignored: ["**/tests/.output/**", "**/coverage/**"],
      },
    },
  },
  adapter: node({
    mode: "standalone",
  }),
});

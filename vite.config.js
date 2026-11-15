import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the built site from the gh-pages branch at
// https://notabiral.github.io/MyBudget/ — every asset path must be
// relative to that base. Keep this in sync with README.md.
export default defineConfig({
  base: "/MyBudget/",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The build uses relative asset paths (base "./") so the same output
// serves from any path: GitHub Pages under /MyBudget/ and Vercel at
// the domain root. Keep this in sync with README.md.
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
  },
});

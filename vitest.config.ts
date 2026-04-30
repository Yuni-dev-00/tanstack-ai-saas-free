import { defineConfig } from "vitest/config";
import viteTsConfigPaths from "vite-tsconfig-paths";

// Separate from vite.config.ts so unit tests run in plain node,
// NOT in the Cloudflare Workers sandbox (which breaks CommonJS deps
// like tiny-warning that testing libraries pull in).
export default defineConfig({
  plugins: [viteTsConfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "dist", ".open-next", ".wrangler"],
  },
});

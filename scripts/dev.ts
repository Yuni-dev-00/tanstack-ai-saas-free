// Wrapper that loads .dev.vars → sets the special env var Wrangler needs
// for the local Hyperdrive emulator, then spawns `vite dev`.
//
import { config } from "dotenv";
import { spawn } from "node:child_process";

config({ path: ".dev.vars" });

if (!process.env.DATABASE_URL) {
  console.error("[dev] DATABASE_URL missing from .dev.vars — cannot start.");
  process.exit(1);
}

process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE =
  process.env.DATABASE_URL;

const child = spawn("npx", ["vite", "dev", "--port", "3000"], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));

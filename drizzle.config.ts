import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load DATABASE_URL (and other secrets) from .dev.vars so local `pnpm db:*`
// commands don't need DATABASE_URL=... prefix.
config({ path: ".dev.vars" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Check .dev.vars exists and is populated.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});

// Wipes the public schema and drizzle's migration tracking so we can
// re-run migrations from scratch. LOCAL-DEV-ONLY, never call in prod.
import { config } from "dotenv";
config({ path: ".dev.vars" });

import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not set");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

console.log("[reset] dropping public schema and drizzle schema");
await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
await pool.query(`DROP SCHEMA IF EXISTS drizzle CASCADE;`);
console.log("[reset] done");

await pool.end();

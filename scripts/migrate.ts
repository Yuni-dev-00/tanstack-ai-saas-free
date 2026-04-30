import { config } from "dotenv";
config({ path: ".dev.vars" });

import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not set — check .dev.vars");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

console.log("[migrate] applying migrations from ./src/db/migrations ...");
await migrate(db, { migrationsFolder: "./src/db/migrations" });
console.log("[migrate] done");

await pool.end();

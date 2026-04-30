import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

// Architecture: Neon docs + Cloudflare Hyperdrive docs recommend:
//   - Use pg.Client (not pg.Pool) — Hyperdrive manages pooling at the edge
//   - Create a new Client per request
//   - Clean up with ctx.waitUntil(client.end())
//   - Local dev uses localConnectionString in wrangler.jsonc, same code path
//
// References:
//   https://neon.com/docs/guides/cloudflare-workers
//   https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/

export async function createDb(connectionString: string): Promise<{ db: DB; client: pg.Client }> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const db = drizzle(client, { schema });
  return { db, client };
}

export async function withDb<T>(
  connectionString: string,
  fn: (db: DB) => Promise<T>,
): Promise<T> {
  const { db, client } = await createDb(connectionString);
  try {
    return await fn(db);
  } finally {
    await client.end();
  }
}

export function resolveConnectionString(env: {
  HYPERDRIVE?: { connectionString: string };
  DATABASE_URL?: string;
}): string {
  const url = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
  if (!url) throw new Error("Neither HYPERDRIVE binding nor DATABASE_URL is configured");
  return url;
}

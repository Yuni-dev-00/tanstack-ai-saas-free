import { env } from "cloudflare:workers";
import { createMiddleware } from "@tanstack/react-start";
import { createDb, resolveConnectionString } from "@/db/client";

// Creates a per-request pg.Client + drizzle handle, makes both reachable
// to downstream middleware/handlers via context, and closes the client
// after the handler returns. Server function runtime has no ctx.waitUntil,
// so cleanup is awaited — the ~10ms cost is bounded and acceptable.
//
// Chained before every auth/rate-limit middleware; one client per request.
export const dbMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const connectionString = resolveConnectionString(env);
    const { db, client } = await createDb(connectionString);
    try {
      return await next({ context: { db, env } });
    } finally {
      await client.end().catch(() => {
        /* best-effort — isolate may already be tearing down */
      });
    }
  },
);

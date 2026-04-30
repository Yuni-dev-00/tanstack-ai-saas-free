import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { queryOptions } from "@tanstack/react-query";
import { createAuthInstance, buildAuthOptions } from "./auth";
import { createDb, resolveConnectionString } from "@/db/client";
import type { WorkerEnv } from "./env";

export const getSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const { env } = await import("cloudflare:workers");
    const e = env as WorkerEnv;
    const { db, client } = await createDb(resolveConnectionString(e));
    try {
      const auth = createAuthInstance(db, buildAuthOptions(e));
      const headers = getRequestHeaders();
      const session = await auth.api.getSession({ headers });
      return session ?? null;
    } finally {
      await client.end().catch(() => {});
    }
  },
);

export const authKeys = {
  session: ["auth", "session"] as const,
};

export const sessionQueryOptions = () =>
  queryOptions({
    queryKey: [...authKeys.session],
    queryFn: () => getSession(),
    staleTime: 5 * 60 * 1000,
  });

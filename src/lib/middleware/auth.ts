import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createAuthInstance, buildAuthOptions } from "@/lib/auth";
import type { WorkerEnv } from "@/lib/env";
import { localizedError } from "@/lib/i18n/localized-error";
import { dbMiddleware } from "./db";

// Resolves a Better Auth session for the current request. Creates the
// auth instance per request using the DB client from dbMiddleware
// (follows Hyperdrive docs: one pg.Client per request).
//
// Downstream middleware / handlers can read `context.user` (User | null),
// `context.session`, `context.appUrl`, and `context.request`.
export const optionalAuthMiddleware = createMiddleware({ type: "function" })
  .middleware([dbMiddleware])
  .server(async ({ next, context }) => {
    const e = context.env as WorkerEnv;
    const request = getRequest();
    const appUrl = e.APP_URL || e.BETTER_AUTH_URL || "";
    if (!appUrl) throw new Error("APP_URL not configured");
    const auth = createAuthInstance(context.db, buildAuthOptions(e));

    const session = await auth.api.getSession({ headers: request.headers });
    return next({
      context: {
        session,
        user: session?.user ?? null,
        appUrl,
        request,
      },
    });
  });

// Throws a localized "sign in required" error if there is no session.
// Downstream `context.user` is narrowed to non-null. Use for server fns
// that require a signed-in user (account settings, anything that
// mutates user-owned data).
export const requireAuthMiddleware = createMiddleware({ type: "function" })
  .middleware([optionalAuthMiddleware])
  .server(async ({ next, context }) => {
    if (!context.user || !context.session) {
      throw localizedError(context.request, "errors.unauthorized");
    }
    return next({
      context: {
        session: context.session,
        user: context.user,
      },
    });
  });

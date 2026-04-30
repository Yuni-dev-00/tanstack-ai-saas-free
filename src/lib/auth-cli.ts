// CLI-only entrypoint for @better-auth/cli. Importing this file creates
// a BetterAuth instance eagerly (read-only: the CLI just walks the
// adapter + plugin list to emit the Drizzle schema). It uses process.env
// which is Node-only, so this file must NEVER be imported from Worker
// runtime code. The build keeps it out of the Worker bundle because no
// production module imports it.
//
// Usage:
//   pnpm dlx @better-auth/cli generate --config src/lib/auth-cli.ts --output src/db/schema.auth.ts
//
// Why it's separate: src/lib/auth.ts used to export this as a named
// const, which made the Worker pay full BetterAuth + passkey + Google
// OAuth init cost at every cold start.

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { passkey } from "@better-auth/passkey";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { additionalUserFields } from "./auth";

const placeholderUrl =
  process.env.DATABASE_URL ?? "postgresql://cli@localhost/cli";
const cliPool = new pg.Pool({ connectionString: placeholderUrl, max: 1 });
const cliDb = drizzle(cliPool);

export const auth = betterAuth({
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "cli-placeholder-secret-32-characters",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: drizzleAdapter(cliDb, {
    provider: "pg",
    usePlural: true,
  }),
  user: { additionalFields: additionalUserFields },
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  plugins: [passkey()],
});

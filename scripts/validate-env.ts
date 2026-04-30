// Build-time env validation. Run in CI before `pnpm build` to fail
// fast when a required runtime-facing variable is missing — better
// than a 500 at cold-start with a cryptic "undefined" somewhere deep.
//
// Rules:
//  - DATABASE_URL / HYPERDRIVE are RUNTIME-only. If a build step ever
//    reads them, a route is doing DB work at prerender — which works
//    in CI (secret is passed) and silently breaks on a fresh clone
//    without `.dev.vars`. We explicitly don't list them here.
//  - Values with fallbacks (EMAIL_REPLY_TO, PLAUSIBLE_*) are optional
//    at build time; their feature is a no-op when absent.
//
// Exit 0 on success, 1 on missing required vars.

// Intentionally no dependencies — runs with tsx on a naked node in CI.

// Required vars that must be present at RUNTIME for basic boot. The
// CI job exports these from GitHub secrets via wrangler; validating
// here means a missing secret surfaces at workflow time, not at the
// first prod request.
const RUNTIME_REQUIRED = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE",
];

const OPTIONAL = [
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
  "SENTRY_DSN",
  "APP_VERSION",
  "GIT_COMMIT",
  "PLAUSIBLE_DOMAIN",
  "PLAUSIBLE_SCRIPT_URL",
  "PLAUSIBLE_SCRIPT_SRI",
];

const mode = process.argv[2] ?? "build";
const missing: string[] = [];

if (mode === "runtime") {
  // Full runtime check — ideally you'd run this against the Worker's
  // `wrangler secret list` output before deploy. Here we just check the
  // process env so the CI job can export secrets with the same names
  // and run this as a sanity gate.
  for (const key of RUNTIME_REQUIRED) {
    if (!process.env[key]) missing.push(key);
  }
  if (missing.length) {
    console.error(
      `❌ Missing runtime env vars (${missing.length}):\n  - ${missing.join("\n  - ")}`,
    );
    process.exit(1);
  }
  console.log(
    `✓ All ${RUNTIME_REQUIRED.length} required runtime env vars present.`,
  );
  const presentOpt = OPTIONAL.filter((k) => process.env[k]).length;
  console.log(
    `  (${presentOpt}/${OPTIONAL.length} optional vars also set.)`,
  );
} else {
  // `build` mode: confirm nothing leaks a real DATABASE_URL into the
  // build container. SSG prerender must not touch the DB — if it does,
  // the build will silently succeed in CI but fail on a fresh clone.
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && !dbUrl.includes("build-only@invalid")) {
    console.error(
      `⚠️  Build received a real DATABASE_URL. If a route calls the DB at prerender, this will silently pass CI but break fresh clones.`,
    );
    console.error(`   URL starts with: ${dbUrl.slice(0, 24)}…`);
    process.exit(1);
  }
  console.log("✓ Build env is clean (no real DATABASE_URL leaked).");
}

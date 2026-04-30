// Batch-upload all non-empty secrets from .dev.vars into the Worker via
// `wrangler secret bulk`. Skips keys that live in wrangler.jsonc vars
// (e.g. APP_URL) and overrides for prod where different from local.
//
// Usage:
//   pnpm tsx scripts/put-secrets.ts
//
// Reads .dev.vars, writes /tmp/secrets.json, runs wrangler secret bulk,
// then deletes the tmp file.

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";

const PROD_URL = "https://example.com";
const PROD_DOMAIN = "example.com";

// Keys already defined as `vars` in wrangler.jsonc — do NOT double-bind as secret.
const SKIP = new Set(["APP_URL"]);

// Prod overrides for keys that differ from local .dev.vars values.
const PROD_OVERRIDES: Record<string, string> = {
  BETTER_AUTH_URL: PROD_URL,
  PLAUSIBLE_DOMAIN: PROD_DOMAIN,
};

const raw = readFileSync(".dev.vars", "utf-8");
const secrets: Record<string, string> = {};

for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  if (!val) continue;
  if (SKIP.has(key)) {
    console.log(`[skip vars-bound] ${key}`);
    continue;
  }
  if (PROD_OVERRIDES[key]) {
    val = PROD_OVERRIDES[key];
    console.log(`[override for prod] ${key}`);
  }
  secrets[key] = val;
}

console.log(`[bulk] uploading ${Object.keys(secrets).length} secrets`);
const tmp = "/tmp/wrangler-secrets.json";
writeFileSync(tmp, JSON.stringify(secrets));

const res = spawnSync("npx", ["wrangler", "secret", "bulk", tmp], {
  stdio: "inherit",
  env: process.env,
});

try {
  unlinkSync(tmp);
} catch {
  /* ignore */
}

if (res.status !== 0) process.exit(res.status ?? 1);

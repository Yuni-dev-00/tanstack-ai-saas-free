import { AwsClient } from "aws4fetch";

// Two access paths to R2:
//   1. Worker binding (env.ASSETS_BUCKET) — zero-copy put/get/head/delete
//      for server-side access (download AI outputs, HEAD-verify uploads).
//   2. S3 presigned PUT URL — for browser-direct large uploads, which a
//      Worker can't receive cheaply (50MB bodies would blow memory).
// aws4fetch is ~4KB, vs @aws-sdk/client-s3 which is hundreds of KB and
// would bloat the Worker bundle unnecessarily.
//
// env is passed in from the request handler — keeping it out of this
// module lets tests build a mock env without importing cloudflare:workers.

export interface R2Env {
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET: string;
  R2_PUBLIC_BASE: string;
  ASSETS_BUCKET: R2Bucket;
}

// Stable key schemes. Consolidated here so the webhook handler, upload
// server fn, and status server fn all speak the same layout.
//
//   jobs/<jobId>/<index>.<ext>        AI output
//   u/<userId>/uploads/<ulid>.<ext>   authed user direct upload
//   u/anon-<ipHash>/uploads/<ulid>.<ext>  anon direct upload
export function jobOutputKey(jobId: string, index: number, ext: string): string {
  return `jobs/${jobId}/${index}.${ext}`;
}

export function uploadKey(
  ownerPrefix: string,
  ulid: string,
  ext: string,
): string {
  return `u/${ownerPrefix}/uploads/${ulid}.${ext}`;
}

export function publicUrlFor(env: Pick<R2Env, "R2_PUBLIC_BASE">, key: string): string {
  const base = env.R2_PUBLIC_BASE.replace(/\/$/, "");
  return `${base}/${key}`;
}

// Presigned PUT URL for browser-direct uploads. Returns a URL the
// browser can PUT a file body to, expiring in `expiresInSec` (default
// 5 min). After the PUT completes the client calls commitUpload
// (server fn) which HEAD-verifies the actual size / content-type
// matches what was declared.
export async function presignUploadUrl(
  env: Pick<R2Env, "R2_ACCOUNT_ID" | "R2_ACCESS_KEY_ID" | "R2_SECRET_ACCESS_KEY" | "R2_BUCKET">,
  key: string,
  contentType: string,
  expiresInSec = 5 * 60,
): Promise<string> {
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  // encodeURIComponent on each "/"-separated segment so future keys
  // containing "?", "#", "&", "+" don't truncate at the URL parser.
  const encodedKey = key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const url = new URL(
    `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${encodedKey}`,
  );
  url.searchParams.set("X-Amz-Expires", String(expiresInSec));

  const signed = await client.sign(
    new Request(url.toString(), {
      method: "PUT",
      headers: { "content-type": contentType },
    }),
    { aws: { signQuery: true } },
  );
  return signed.url;
}

// Server-side: download a remote URL and upload it to R2 via S3 API.
// Uses aws4fetch (4KB) rather than Worker binding so it works in both
// production and local dev. The flow mirrors nexty's fetchExternalUrlToR2:
// fetch → arrayBuffer → S3 PutObject.
//
// SSRF guard: `isAllowedUrl` is REQUIRED. See allowlists.ts.
export async function putFromUrl(
  env: Pick<R2Env, "R2_ACCOUNT_ID" | "R2_ACCESS_KEY_ID" | "R2_SECRET_ACCESS_KEY" | "R2_BUCKET">,
  key: string,
  sourceUrl: string,
  isAllowedUrl: (url: string) => boolean,
  timeoutMs = 60_000,
): Promise<{ size: number; contentType: string }> {
  if (!isAllowedUrl(sourceUrl)) {
    throw new Error(`putFromUrl: source URL rejected by allowlist: ${sourceUrl}`);
  }
  const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    throw new Error(
      `putFromUrl ${sourceUrl} → ${res.status} ${res.statusText}`,
    );
  }
  const contentType =
    res.headers.get("content-type") ?? "application/octet-stream";
  const body = await res.arrayBuffer();

  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });

  const encodedKey = key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");

  const putUrl = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${encodedKey}`;
  const putRes = await client.fetch(putUrl, {
    method: "PUT",
    headers: { "content-type": contentType },
    body,
  });

  if (!putRes.ok) {
    const errBody = await putRes.text().catch(() => "");
    throw new Error(`R2 S3 PUT failed: ${putRes.status} — ${errBody.slice(0, 200)}`);
  }

  return { size: body.byteLength, contentType };
}

// Extension inference — matches the provider adapter guesses but drops
// off the vendor-free "application/octet-stream" fallback since R2 keys
// need a real extension for browsers to detect MIME correctly.
export function extForMime(mime: string): string {
  switch (mime) {
    case "image/png": {
      return "png";
    }
    case "image/jpeg": {
      return "jpg";
    }
    case "image/webp": {
      return "webp";
    }
    case "image/gif": {
      return "gif";
    }
    case "video/mp4": {
      return "mp4";
    }
    default: {
      return "bin";
    }
  }
}

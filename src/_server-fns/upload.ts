import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { assets } from "@/db/schema";
import { assertSameOrigin } from "@/lib/security-headers";
import { consume, extractClientIp } from "@/lib/rate-limit";
import { log } from "@/lib/log";
import {
  presignUploadUrl,
  uploadKey,
  extForMime,
  type R2Env,
} from "@/lib/r2";
import { hashAnonKey } from "@/lib/ai/jobs";
import { optionalAuthMiddleware } from "@/lib/middleware/auth";
import type { WorkerEnv } from "@/lib/env";

// Upload flow:
//   1. client requestUpload({contentType, size, ulid}) → server validates,
//      returns { uploadUrl, assetKey }
//   2. client PUTs body direct to presigned R2 URL
//   3. client commitUpload({assetKey, declaredSize}) → server HEADs R2,
//      verifies size/contentType, rejects mismatches (deletes the object
//      + logs), else inserts `assets` row with dedup on r2Key.

const ALLOWED_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const ALLOWED_CT_SET = new Set<string>(ALLOWED_CONTENT_TYPES);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const SIZE_SLACK_BYTES = 1024; // 1 KB overshoot tolerance
const PRESIGN_BUDGET_PER_HOUR = 20; // per IP; matches typical user ~10 uploads/session

function assertR2Env(e: Env): asserts e is Env & Required<R2Env> {
  const missing: string[] = [];
  if (!e.R2_ACCOUNT_ID) missing.push("R2_ACCOUNT_ID");
  if (!e.R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
  if (!e.R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
  if (!e.R2_BUCKET) missing.push("R2_BUCKET");
  if (!e.R2_PUBLIC_BASE) missing.push("R2_PUBLIC_BASE");
  if (!e.ASSETS_BUCKET) missing.push("ASSETS_BUCKET binding");
  if (missing.length > 0) throw new Error(`R2 env missing: ${missing.join(", ")}`);
}

async function ownerPrefixFor(
  request: Request,
  userId: string | null,
): Promise<string> {
  if (userId) return `user_${userId}`;
  // Full hash output — matches jobs.meta.anonKey scheme (C-1).
  const hash = await hashAnonKey(
    extractClientIp(request),
    request.headers.get("user-agent") ?? "",
  );
  return `anon-${hash}`;
}

// -- requestUpload --------------------------------------------------------

const requestUploadInput = z.object({
  contentType: z.enum(ALLOWED_CONTENT_TYPES),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  // Client mints the ULID (26 chars Crockford base32) so we don't have
  // to round-trip server state between the two calls.
  ulid: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, "invalid ULID"),
});

export const requestUpload = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .inputValidator((raw: unknown) => requestUploadInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { db, user, request, appUrl } = context;
    assertSameOrigin(request, appUrl);
    assertR2Env(env);

    const userId = user?.id ?? null;

    // Per-user OR per-IP presign rate limit (C-2). Attackers who can
    // presign unlimited URLs don't even need to upload — they'd just
    // force R2 auth-header generation cost on us. 20/h is loose for real
    // users (~5-10 per session) but hard for a fuzzer.
    const rateKey = userId
      ? `upload-presign:user:${userId}`
      : `upload-presign:ip:${extractClientIp(request)}`;
    await consume(
      db,
      {
        key: rateKey,
        budget: PRESIGN_BUDGET_PER_HOUR,
        windowSec: 3600,
      },
      env as WorkerEnv,
    );

    const ownerPrefix = await ownerPrefixFor(request, userId);
    const ext = extForMime(data.contentType);
    const key = uploadKey(ownerPrefix, data.ulid, ext);
    const uploadUrl = await presignUploadUrl(env, key, data.contentType);

    return { uploadUrl, assetKey: key };
  });

// -- commitUpload ---------------------------------------------------------

const commitUploadInput = z.object({
  assetKey: z.string().min(1).max(512),
  declaredSize: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export const commitUpload = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .inputValidator((raw: unknown) => commitUploadInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { db, user, request, appUrl } = context;
    assertSameOrigin(request, appUrl);
    assertR2Env(env);

    const userId = user?.id ?? null;

    // Ownership prefix gate. Without this, an authenticated caller
    // could pass `assetKey: "jobs/<victim-job-id>/0.png"` (or any other
    // user's upload key) and have us register an `assets` row pointing
    // at it under their own userId — effectively stealing the public
    // URL for someone else's R2 object. The presigned-URL flow already
    // confines `requestUpload` to keys under `u/<ownerPrefix>/uploads/`,
    // so legitimate commits always start with that prefix.
    const ownerPrefix = await ownerPrefixFor(request, userId);
    const expectedPrefix = `u/${ownerPrefix}/uploads/`;
    if (data.assetKey.includes("..") || !data.assetKey.startsWith(expectedPrefix)) {
      log("warn", "upload.commit.foreign_asset_key", {
        userId,
        attemptedKey: data.assetKey,
        expectedPrefix,
      });
      throw new Error("assetKey does not belong to caller");
    }

    // M-4: dedup. If user double-clicked commit and we already inserted
    // an asset row for this r2Key under their ownership, return the
    // existing row instead of inserting a second.
    const existing = await db
      .select({ id: assets.id })
      .from(assets)
      .where(
        and(
          eq(assets.r2Key, data.assetKey),
          userId ? eq(assets.userId, userId) : isNull(assets.userId),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      return {
        assetId: existing[0]!.id,
        publicUrl: `${env.R2_PUBLIC_BASE.replace(/\/$/, "")}/${data.assetKey}`,
      };
    }

    const obj = await env.ASSETS_BUCKET.head(data.assetKey);
    if (!obj) {
      throw new Error(`upload not found: ${data.assetKey}`);
    }

    const actualContentType =
      obj.httpMetadata?.contentType ?? "application/octet-stream";
    const okContentType = ALLOWED_CT_SET.has(actualContentType);
    // Two independent size checks:
    //   1. Within declared size (+ tiny slack) — what the client said.
    //   2. Within MAX_UPLOAD_BYTES hard cap — what we'll ever accept.
    // Without (2), a malicious client can declare 100 MB and presign+
    // upload 100 MB even though the requestUpload schema caps declared
    // size at 10 MB. Belt-and-suspenders: requestUpload validates the
    // declared bound, commitUpload validates the actual stored size.
    const okSize =
      obj.size <= data.declaredSize + SIZE_SLACK_BYTES &&
      obj.size <= MAX_UPLOAD_BYTES + SIZE_SLACK_BYTES;

    if (!okContentType || !okSize) {
      await env.ASSETS_BUCKET.delete(data.assetKey).catch(() => {
        /* intentional: deletion failure is non-fatal, R2 GC handles strays */
      });
      log("warn", "upload.commit.rejected", {
        key: data.assetKey,
        actualSize: obj.size,
        declaredSize: data.declaredSize,
        actualContentType,
        userId,
      });
      throw new Error(
        `upload verification failed: size=${obj.size} contentType=${actualContentType}`,
      );
    }

    const [row] = await db
      .insert(assets)
      .values({
        userId,
        r2Key: data.assetKey,
        mime: actualContentType,
        meta: { source: "upload" },
      })
      .returning({ id: assets.id });
    if (!row) throw new Error("commitUpload: insert returned no row");

    log("info", "upload.commit.ok", {
      assetId: row.id,
      key: data.assetKey,
      size: obj.size,
    });

    return {
      assetId: row.id,
      publicUrl: `${env.R2_PUBLIC_BASE.replace(/\/$/, "")}/${data.assetKey}`,
    };
  });

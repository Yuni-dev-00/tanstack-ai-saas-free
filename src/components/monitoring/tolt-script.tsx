// Tolt affiliate SDK loader. Tolt's docs:
//   https://tolt.com/docs/install
//
// The SDK reads the URL `?tolt_referral=` (or whatever code your Tolt
// program is configured for) and attaches it to user actions until
// they convert. We additionally snapshot the code into our user_sources
// table at signup time (lib/tracking/client.ts captureFirstTouch +
// _server-fns/record-signup-source.ts) so payouts can be reconciled
// against our own DB without touching Tolt's API.
//
// Renders nothing if `programId` is null/undefined — the parent passes
// the env value, and unset = SDK not loaded (template ships with no
// affiliate program by default).

interface ToltScriptProps {
  programId: string | null;
}

export function ToltScript({ programId }: ToltScriptProps) {
  if (!programId) return null;
  // SRI not pinned: Tolt's snippet doesn't expose a stable hash, and the
  // file is small (~1KB) + same-origin'd to cdn.tolt.io. Tradeoff: we
  // accept that a Tolt CDN compromise could inject script. If you want
  // SRI, request a versioned URL from Tolt and pin like Plausible.
  const src = "https://cdn.tolt.io/tolt.js";
  return (
    <script
      async
      src={src}
      data-tolt={programId}
      // crossOrigin="anonymous" is needed for the script to be eligible
      // for SRI in the future and for any CORS-sensitive operations.
      crossOrigin="anonymous"
    />
  );
}

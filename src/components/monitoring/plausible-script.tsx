import type { PlausibleConfig } from "@/_server-fns/site-config";

// Renders the Plausible tracking script with Subresource Integrity (SRI)
// pinned. Skipped entirely in dev — there's no point polluting the
// dashboard with localhost hits. Returns null when the Worker hasn't
// been given the three PLAUSIBLE_* env vars, so a product spawned from
// this template can still ship before provisioning Plausible.
//
// [BRAND TODO] A product that wants self-hosted + custom events should
// also accept `apiHost` / `event` props here and pass them through as
// data-api / data-exclude attributes on the <script>.

export function PlausibleScript({
  config,
}: {
  config: PlausibleConfig | null;
}) {
  if (!config) return null;
  if (import.meta.env.DEV) return null;
  return (
    <script
      defer
      data-domain={config.domain}
      src={config.scriptUrl}
      integrity={config.sri}
      crossOrigin="anonymous"
    />
  );
}

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export function Rybbit({
  scriptUrl, siteId, sessionReplay, maskSelectors,
}: {
  scriptUrl: string | undefined;
  siteId: string | undefined;
  sessionReplay?: string;
  maskSelectors?: string;
}) {
  if (!scriptUrl || !siteId || !scriptUrl.startsWith("https://") || !SAFE_ID.test(siteId)) return null;
  const replay = sessionReplay === "true";
  return (
    <script
      async
      defer
      src={scriptUrl}
      data-site-id={siteId}
      {...(replay ? { "data-session-replay": "true" } : {})}
      {...(maskSelectors ? { "data-replay-mask": maskSelectors } : {})}
    />
  );
}

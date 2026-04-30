const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export function Umami({ scriptUrl, websiteId }: { scriptUrl: string | undefined; websiteId: string | undefined }) {
  if (!scriptUrl || !websiteId || !scriptUrl.startsWith("https://") || !SAFE_ID.test(websiteId)) return null;
  return <script async defer src={scriptUrl} data-website-id={websiteId} />;
}

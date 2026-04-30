const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export function GoogleAdSense({ id }: { id: string | undefined }) {
  if (!id || !SAFE_ID.test(id)) return null;
  return <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${id}`} crossOrigin="anonymous" />;
}

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export function GoogleAnalytics({ id }: { id: string | undefined }) {
  if (!id || !SAFE_ID.test(id)) return null;
  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${id}`} />
      <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');` }} />
    </>
  );
}

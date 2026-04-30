export function VercelAnalytics({ id }: { id: string | undefined }) {
  if (!id) return null;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: `window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments);};` }} />
      <script defer src="/_vercel/insights/script.js" />
    </>
  );
}

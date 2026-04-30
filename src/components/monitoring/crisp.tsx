const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export function Crisp({ websiteId }: { websiteId: string | undefined }) {
  if (!websiteId || !SAFE_ID.test(websiteId)) return null;
  return (
    <script dangerouslySetInnerHTML={{ __html: `window.$crisp=[];window.CRISP_WEBSITE_ID="${websiteId}";(function(){var d=document;var s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();` }} />
  );
}

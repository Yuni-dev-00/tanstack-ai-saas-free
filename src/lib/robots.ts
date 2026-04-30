import { absoluteUrl } from "@/lib/site";

export function robotsResponse(): Response {
  const body = `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Disallow: /api/auth/
Disallow: /auth/success
Disallow: /sign-in
Disallow: /sign-up

Sitemap: ${absoluteUrl("/sitemap.xml")}
`;
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

import { describe, it, expect, afterEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlausibleScript } from "./plausible-script";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PlausibleScript", () => {
  it("renders null when config is absent — never blocks initial render on a missing env", () => {
    vi.stubEnv("DEV", false);
    expect(renderToStaticMarkup(<PlausibleScript config={null} />)).toBe("");
  });

  it("renders null in dev even when config is present — localhost stays out of analytics", () => {
    vi.stubEnv("DEV", true);
    const html = renderToStaticMarkup(
      <PlausibleScript
        config={{
          domain: "example.com",
          scriptUrl: "https://p.example.com/script.js",
          sri: "sha384-abc",
        }}
      />,
    );
    expect(html).toBe("");
  });

  it("renders a defer'd script with SRI + crossorigin in prod", () => {
    vi.stubEnv("DEV", false);
    const html = renderToStaticMarkup(
      <PlausibleScript
        config={{
          domain: "example.com",
          scriptUrl: "https://p.example.com/script.js",
          sri: "sha384-abc",
        }}
      />,
    );
    expect(html).toContain('defer=""');
    expect(html).toContain('data-domain="example.com"');
    expect(html).toContain('src="https://p.example.com/script.js"');
    expect(html).toContain('integrity="sha384-abc"');
    expect(html).toContain('crossorigin="anonymous"');
  });
});

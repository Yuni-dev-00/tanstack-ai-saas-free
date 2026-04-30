import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

// JSON-LD builders — emit one object per schema.org type we care about.
// Rendered inside <script type="application/ld+json"> via TanStack
// Router's head().scripts array. Kept as a builder (not a component)
// so the same object can be serialized from a route loader, a server
// fn, or an edge OG-image renderer without React-specific scaffolding.
//
// Validation: manually paste output into https://search.google.com/test/rich-results
// after big edits. All fields are optional for the Organization / WebSite
// types, but when present they unlock sitelinks + the knowledge panel.

export interface JsonLd {
  "@context": "https://schema.org";
  "@type": string;
  [k: string]: unknown;
}

// Site-wide Organization — same across every page. A product with a
// real brand should also add `logo`, `sameAs` (social profiles), and
// `contactPoint`. [BRAND TODO]
export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
  };
}

// WebSite entry with search box — if the site has a search endpoint,
// fill `target`. Omitted today because this template has no /search.
export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
  };
}

export interface SoftwareAppInput {
  name: string;
  description: string;
  applicationCategory?: string;
  operatingSystem?: string;
  aggregateRating?: { ratingValue: number; ratingCount: number };
}

export function softwareApplicationJsonLd(app: SoftwareAppInput): JsonLd {
  const obj: JsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: app.name,
    description: app.description,
    url: SITE_URL,
    applicationCategory: app.applicationCategory ?? "WebApplication",
    operatingSystem: app.operatingSystem ?? "All",
  };
  if (app.aggregateRating) {
    obj.aggregateRating = { "@type": "AggregateRating", ...app.aggregateRating };
  }
  return obj;
}

export interface BreadcrumbItem { name: string; url: string }

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem", position: i + 1, name: item.name, item: item.url,
    })),
  };
}

export interface FaqItem { question: string; answer: string }

export function faqPageJsonLd(items: FaqItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

// Helper: turn an array of JSON-LD objects into TanStack Router
// head().scripts entries. Each script type is application/ld+json with
// the stringified payload.
export function jsonLdScripts(
  objs: JsonLd[],
): Array<{ type: "application/ld+json"; children: string }> {
  return objs.map((o) => ({
    type: "application/ld+json" as const,
    children: JSON.stringify(o),
  }));
}

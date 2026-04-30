import { createFileRoute } from "@tanstack/react-router";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { UseCasesSection } from "@/components/landing/use-cases-section";
import { FaqSection } from "@/components/landing/faq-section";
import { CtaSection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";
import { seo } from "@/utils/seo";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { getMessages, t } from "@/lib/i18n/resolver";
import { assertLocaleOrRedirect, seoLocale } from "@/lib/i18n/route-locale";
import { DefaultCatchBoundary } from "@/components/default-catch-boundary";
import { DefaultPending } from "@/components/default-pending";

// Landing page for every locale. `{-$locale}` is a TanStack Router optional
// path param, so this single file matches "/", "/zh", "/ja", etc. The
// param's value drives canonical/hreflang SEO; UI translation comes from
// useT() (root context resolver: URL > cookie > Accept-Language).

export const Route = createFileRoute("/{-$locale}/_sidebar/")({
  beforeLoad: ({ params, context }) => {
    assertLocaleOrRedirect(
      params.locale,
      { to: "/{-$locale}", params: { locale: undefined } },
      context.locale,
    );
  },
  head: ({ params }) => {
    const locale = seoLocale(params.locale);
    const messages = getMessages(locale);
    return seo({
      title: `${SITE_NAME} | ${t(messages, "seo.homeTitle")}`,
      description: SITE_DESCRIPTION,
      path: "/",
      locale,
    });
  },
  errorComponent: DefaultCatchBoundary,
  pendingComponent: DefaultPending,
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <main>
        <HeroSection />
        <FeaturesSection />
        <TestimonialsSection />
        <UseCasesSection />
        <FaqSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}

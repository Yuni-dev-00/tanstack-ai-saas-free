import { createFileRoute } from "@tanstack/react-router";
import { Footer } from "@/components/landing/footer";
import { seo } from "@/utils/seo";
import { SITE_NAME } from "@/lib/site";
import { assertLocaleOrRedirect, seoLocale } from "@/lib/i18n/route-locale";
import { DefaultCatchBoundary } from "@/components/default-catch-boundary";

export const Route = createFileRoute("/{-$locale}/_sidebar/terms-of-service")({
  beforeLoad: ({ params, context }) => {
    assertLocaleOrRedirect(
      params.locale,
      { to: "/{-$locale}/terms-of-service", params: { locale: undefined } },
      context.locale,
    );
  },
  head: ({ params }) => {
    const locale = seoLocale(params.locale);
    return seo({ title: `Terms of Service | ${SITE_NAME}`, path: "/terms-of-service", locale });
  },
  errorComponent: DefaultCatchBoundary,
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-16 prose dark:prose-invert">
        <h1>Terms of Service</h1>
        <p>Last updated: 2026-04-25</p>
        <h2>Acceptance</h2>
        <p>By using this service, you agree to these terms.</p>
        <h2>Account</h2>
        <p>You are responsible for maintaining the security of your account credentials.</p>
        <h2>Paid Features</h2>
        <p>This starter does not include paid features by default. If you extend it with monetized functionality, document the terms clearly.</p>
        <h2>Acceptable Use</h2>
        <p>You may not use the service for illegal purposes, to generate harmful content, or to circumvent usage limits.</p>
        <h2>Termination</h2>
        <p>We may suspend or terminate accounts that violate these terms. You may delete your account at any time.</p>
        <h2>Limitation of Liability</h2>
        <p>The service is provided &ldquo;as is&rdquo; without warranties. Our liability is limited to the amount you paid in the last 12 months, if any.</p>
      </main>
      <Footer />
    </div>
  );
}

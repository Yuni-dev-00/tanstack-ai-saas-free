import { createFileRoute } from "@tanstack/react-router";
import { Footer } from "@/components/landing/footer";
import { seo } from "@/utils/seo";
import { SITE_NAME } from "@/lib/site";
import { assertLocaleOrRedirect, seoLocale } from "@/lib/i18n/route-locale";
import { DefaultCatchBoundary } from "@/components/default-catch-boundary";

export const Route = createFileRoute("/{-$locale}/_sidebar/privacy-policy")({
  beforeLoad: ({ params, context }) => {
    assertLocaleOrRedirect(
      params.locale,
      { to: "/{-$locale}/privacy-policy", params: { locale: undefined } },
      context.locale,
    );
  },
  head: ({ params }) => {
    const locale = seoLocale(params.locale);
    return seo({ title: `Privacy Policy | ${SITE_NAME}`, path: "/privacy-policy", locale });
  },
  errorComponent: DefaultCatchBoundary,
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-16 prose dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p>Last updated: 2026-04-25</p>
        <h2>Information We Collect</h2>
        <p>We collect information you provide when creating an account (email, name) and usage data to improve our service.</p>
        <h2>How We Use Information</h2>
        <p>Your information is used to provide, maintain, and improve our services, and send transactional emails.</p>
        <h2>Data Sharing</h2>
        <p>We do not sell your personal data. We share data with service providers (Resend for emails and Cloudflare for hosting) as necessary to operate the service.</p>
        <h2>Cookies</h2>
        <p>We use essential cookies for authentication and optional analytics cookies with your consent.</p>
        <h2>Your Rights</h2>
        <p>You can delete your account at any time from the navigation menu. This removes your personal data and anonymizes order records.</p>
        <h2>Contact</h2>
        <p>For privacy inquiries, reply to any transactional email or contact us through the application.</p>
      </main>
      <Footer />
    </div>
  );
}

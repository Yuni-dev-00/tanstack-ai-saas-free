import { useT } from "@/lib/i18n/useT";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export function CtaSection() {
  const { messages } = useT();
  const cta = messages.Landing?.CTA;
  if (!cta?.title) return null;
  return (
    <section className="bg-primary text-primary-foreground py-20">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="text-3xl font-bold">{cta.title}</h2>
        {cta.subtitle && <p className="mt-4 text-lg opacity-90">{cta.subtitle}</p>}
        <Button asChild size="lg" variant="secondary" className="mt-8">
          <Link to="/{-$locale}" params={{ locale: undefined }}>
            {cta.button || "Get Started"}
          </Link>
        </Button>
      </div>
    </section>
  );
}

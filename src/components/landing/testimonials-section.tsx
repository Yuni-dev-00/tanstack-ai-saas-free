import { useT } from "@/lib/i18n/useT";

interface Testimonial {
  name: string;
  role: string;
  quote: string;
  avatar?: string;
}

export function TestimonialsSection() {
  const { messages } = useT();
  const landing = messages.Landing?.Testimonials;
  const items = landing?.items as Testimonial[] | undefined;
  if (!items?.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <h2 className="text-center text-3xl font-bold">
        {landing.title}
      </h2>
      {landing.subtitle && (
        <p className="mt-2 text-center text-muted-foreground">{landing.subtitle}</p>
      )}
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {items.map((it, i) => (
          <figure key={i} className="rounded-lg border p-6">
            <blockquote className="text-sm">&ldquo;{it.quote}&rdquo;</blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              {it.avatar && (
                <img src={it.avatar} alt={it.name} className="h-10 w-10 rounded-full" />
              )}
              <div>
                <div className="font-medium">{it.name}</div>
                <div className="text-xs text-muted-foreground">{it.role}</div>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

import { useT } from "@/lib/i18n/useT";

export function UseCasesSection() {
  const { messages } = useT();
  const landing = messages.Landing?.UseCases;
  const items = landing?.items as Array<{ title: string; description: string }> | undefined;
  if (!items?.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 bg-muted/30">
      <h2 className="text-center text-3xl font-bold">{landing.title}</h2>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {items.map((it, i) => (
          <div key={i} className="rounded-lg bg-background p-6 shadow-sm">
            <h3 className="text-lg font-semibold">{it.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{it.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

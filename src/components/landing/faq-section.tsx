import { useT } from "@/lib/i18n/useT";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import * as React from "react";

export function FaqSection() {
  const { messages } = useT();
  const landing = messages.Landing?.FAQ;
  const items = landing?.items as Array<{ q: string; a: string }> | undefined;
  if (!items?.length) return null;
  return (
    <section className="mx-auto max-w-3xl px-4 py-20">
      <h2 className="text-center text-3xl font-bold">{landing.title}</h2>
      <div className="mt-12 space-y-4">
        {items.map((it, i) => (
          <FaqItem key={i} question={it.q} answer={it.a} />
        ))}
      </div>
    </section>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 text-left font-medium hover:bg-muted/50">
        {question}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 pt-2 text-sm text-muted-foreground">
        {answer}
      </CollapsibleContent>
    </Collapsible>
  );
}

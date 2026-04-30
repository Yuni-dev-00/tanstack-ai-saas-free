import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SliderWithInput } from "./slider-with-input";

type ShadowControlProps = {
  shadowColor: string;
  shadowOpacity: number;
  shadowBlur: number;
  shadowSpread: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  onChange: (key: string, value: string | number) => void;
  ColorSwatch: React.ComponentType<{
    label: string;
    cssVar: string;
    value: string;
    onChange: (v: string) => void;
  }>;
};

export function ShadowControl({
  shadowColor,
  shadowOpacity,
  shadowBlur,
  shadowSpread,
  shadowOffsetX,
  shadowOffsetY,
  onChange,
  ColorSwatch,
}: ShadowControlProps) {
  return (
    <Accordion type="single" defaultValue="shadow" collapsible>
      <AccordionItem value="shadow" className="rounded-lg border px-3">
        <AccordionTrigger className="cursor-pointer py-2.5 text-sm font-medium">
          Shadow
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <ColorSwatch
            label="Shadow Color"
            cssVar="--shadow-color"
            value={shadowColor}
            onChange={(v) => onChange("shadow-color", v)}
          />
          <SliderWithInput
            value={shadowOpacity}
            onChange={(v) => onChange("shadow-opacity", v)}
            min={0}
            max={1}
            step={0.01}
            unit=""
            label="Opacity"
          />
          <SliderWithInput
            value={shadowBlur}
            onChange={(v) => onChange("shadow-blur", v)}
            min={0}
            max={50}
            step={0.5}
            unit="px"
            label="Blur"
          />
          <SliderWithInput
            value={shadowSpread}
            onChange={(v) => onChange("shadow-spread", v)}
            min={-50}
            max={50}
            step={0.5}
            unit="px"
            label="Spread"
          />
          <SliderWithInput
            value={shadowOffsetX}
            onChange={(v) => onChange("shadow-offset-x", v)}
            min={-50}
            max={50}
            step={0.5}
            unit="px"
            label="Offset X"
          />
          <SliderWithInput
            value={shadowOffsetY}
            onChange={(v) => onChange("shadow-offset-y", v)}
            min={-50}
            max={50}
            step={0.5}
            unit="px"
            label="Offset Y"
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

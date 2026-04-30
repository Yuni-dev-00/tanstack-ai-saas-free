import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

type SliderWithInputProps = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  unit?: string;
};

export function SliderWithInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  unit = "px",
}: SliderWithInputProps) {
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => setLocalValue(value), [value]);

  const id = `slider-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <div className="flex items-center gap-1">
          <Input
            id={`input-${id}`}
            type="number"
            value={localValue}
            onChange={(e) => {
              const v = Number(e.target.value);
              setLocalValue(v);
              onChange(v);
            }}
            min={min}
            max={max}
            step={step}
            className="h-6 w-18 px-2 text-xs"
          />
          <span className="text-muted-foreground text-xs">{unit}</span>
        </div>
      </div>
      <Slider
        id={id}
        value={[localValue]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => {
          setLocalValue(v[0] ?? min);
          onChange(v[0] ?? min);
        }}
        className="py-1"
      />
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";
import type { InputHTMLAttributes } from "react";
import { Palette, Copy, RotateCcw, Dices } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { colorFormatter } from "./color-converter";
import { THEME_PRESETS } from "./theme-presets";
import { SliderWithInput } from "./slider-with-input";
import { ShadowControl } from "./shadow-control";

const STORAGE_KEY = "dev-theme-customizer";

const COLOR_GROUPS = [
  {
    key: "brand",
    label: "Brand Colors",
    vars: [
      { key: "--primary", label: "Primary" },
      { key: "--primary-foreground", label: "Primary Foreground" },
      { key: "--secondary", label: "Secondary" },
      { key: "--secondary-foreground", label: "Secondary Foreground" },
      { key: "--destructive", label: "Destructive" },
      { key: "--destructive-foreground", label: "Destructive Foreground" },
    ],
  },
  {
    key: "base",
    label: "Base Colors",
    vars: [
      { key: "--background", label: "Background" },
      { key: "--foreground", label: "Foreground" },
      { key: "--card", label: "Card" },
      { key: "--card-foreground", label: "Card Foreground" },
      { key: "--popover", label: "Popover" },
      { key: "--popover-foreground", label: "Popover Foreground" },
    ],
  },
  {
    key: "other",
    label: "Other Colors",
    vars: [
      { key: "--muted", label: "Muted" },
      { key: "--muted-foreground", label: "Muted Foreground" },
      { key: "--accent", label: "Accent" },
      { key: "--accent-foreground", label: "Accent Foreground" },
      { key: "--border", label: "Border" },
      { key: "--input", label: "Input" },
      { key: "--ring", label: "Ring" },
    ],
  },
  {
    key: "sidebar",
    label: "Sidebar Colors",
    vars: [
      { key: "--sidebar", label: "Sidebar" },
      { key: "--sidebar-foreground", label: "Sidebar Foreground" },
      { key: "--sidebar-primary", label: "Sidebar Primary" },
      { key: "--sidebar-primary-foreground", label: "Sidebar Primary FG" },
      { key: "--sidebar-accent", label: "Sidebar Accent" },
      { key: "--sidebar-accent-foreground", label: "Sidebar Accent FG" },
      { key: "--sidebar-border", label: "Sidebar Border" },
      { key: "--sidebar-ring", label: "Sidebar Ring" },
    ],
  },
  {
    key: "chart",
    label: "Chart Colors",
    vars: [
      { key: "--chart-1", label: "Chart 1" },
      { key: "--chart-2", label: "Chart 2" },
      { key: "--chart-3", label: "Chart 3" },
      { key: "--chart-4", label: "Chart 4" },
      { key: "--chart-5", label: "Chart 5" },
    ],
  },
];

const FONT_OPTIONS: Record<string, Record<string, string>> = {
  sans: {
    System: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    Inter: "Inter, sans-serif",
    "Space Grotesk": "Space Grotesk, sans-serif",
    "DM Sans": "DM Sans, sans-serif",
    Geist: "Geist, sans-serif",
    Montserrat: "Montserrat, sans-serif",
    "Plus Jakarta Sans": "Plus Jakarta Sans, sans-serif",
    Outfit: "Outfit, sans-serif",
    Poppins: "Poppins, sans-serif",
  },
  serif: {
    System: "Georgia, 'Times New Roman', serif",
    Merriweather: "Merriweather, serif",
    "Playfair Display": "Playfair Display, serif",
    Lora: "Lora, serif",
    "Source Serif 4": "Source Serif 4, serif",
  },
  mono: {
    System: "ui-monospace, SFMono-Regular, monospace",
    "JetBrains Mono": "JetBrains Mono, monospace",
    "Fira Code": "Fira Code, monospace",
    "Source Code Pro": "Source Code Pro, monospace",
    "Geist Mono": "Geist Mono, monospace",
  },
};

type DebouncedInputProps = {
  value: string;
  onChange: (value: string) => void;
  debounce?: number;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">;

function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 300,
  ...props
}: DebouncedInputProps) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => setValue(initialValue), [initialValue]);
  useEffect(() => {
    const t = setTimeout(() => onChange(value), debounce);
    return () => clearTimeout(t);
  }, [value, debounce, onChange]);
  return (
    <input
      {...props}
      type="color"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

function ColorSwatch({
  label,
  cssVar,
  value,
  onChange,
}: {
  label: string;
  cssVar: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => setLocalValue(value), [value]);
  const hexColor = colorFormatter(localValue, "hex");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {cssVar}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border shadow-sm"
          style={{ backgroundColor: `var(${cssVar})` }}
        >
          <DebouncedInput
            value={hexColor.startsWith("#") ? hexColor : "#000000"}
            onChange={(hex) => {
              setLocalValue(hex);
              onChange(hex);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
        <input
          type="text"
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            onChange(e.target.value);
          }}
          className="h-9 flex-1 rounded-md border bg-transparent px-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {hexColor}
        </span>
      </div>
    </div>
  );
}

function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function writeCssVar(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

function clearAllOverrides(vars: string[]) {
  for (const v of vars) document.documentElement.style.removeProperty(v);
}

function getAllVarKeys() {
  return COLOR_GROUPS.flatMap((g) => g.vars.map((v) => v.key));
}

const EXTRA_VARS = [
  "--radius",
  "--font-sans",
  "--font-serif",
  "--font-mono",
  "--letter-spacing",
  "--spacing",
  "--shadow-color",
  "--shadow-opacity",
  "--shadow-blur",
  "--shadow-spread",
  "--shadow-offset-x",
  "--shadow-offset-y",
];

function getAllKeys() {
  return [...getAllVarKeys(), ...EXTRA_VARS];
}

function FontSelect({
  label,
  category,
  value,
  onChange,
}: {
  label: string;
  category: "sans" | "serif" | "mono";
  value: string;
  onChange: (v: string) => void;
}) {
  const fonts = FONT_OPTIONS[category] ?? {};
  const currentName =
    Object.entries(fonts).find(([, v]) => v === value)?.[0] ?? "System";

  return (
    <div className="mb-4">
      <Label className="mb-1.5 block text-xs">{label}</Label>
      <Select
        value={currentName}
        onValueChange={(name) => onChange(fonts[name] ?? Object.values(fonts)[0] ?? "")}
      >
        <SelectTrigger className="h-10 w-full cursor-pointer">
          <SelectValue placeholder="Select font" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(fonts).map(([name, stack]) => (
            <SelectItem key={name} value={name}>
              <span style={{ fontFamily: stack }}>{name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ThemeCustomizer() {
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});

  const refreshValues = useCallback(() => {
    const v: Record<string, string> = {};
    for (const key of getAllKeys()) v[key] = readCssVar(key);
    setValues(v);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Record<string, string>;
        for (const [k, v] of Object.entries(parsed)) writeCssVar(k, v);
        setOverrides(parsed);
      } catch {}
    }
    refreshValues();
  }, [refreshValues]);

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === "class") refreshValues();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [refreshValues]);

  const handleChange = useCallback(
    (key: string, value: string) => {
      writeCssVar(key, value);
      const next = { ...overrides, [key]: value };
      setOverrides(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      refreshValues();
    },
    [overrides, refreshValues],
  );

  const applyPreset = useCallback(
    (index: number) => {
      const preset = THEME_PRESETS[index];
      if (!preset) return;
      clearAllOverrides(getAllKeys());
      for (const [k, v] of Object.entries(preset.colors ?? {})) writeCssVar(k, v);
      setOverrides(preset.colors ?? {});
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preset.colors));
      refreshValues();
    },
    [refreshValues],
  );

  const randomPreset = useCallback(() => {
    applyPreset(Math.floor(Math.random() * THEME_PRESETS.length));
  }, [applyPreset]);

  const handleReset = useCallback(() => {
    clearAllOverrides(getAllKeys());
    setOverrides({});
    localStorage.removeItem(STORAGE_KEY);
    refreshValues();
  }, [refreshValues]);

  const handleCopy = useCallback(() => {
    const isDark = document.documentElement.classList.contains("dark");
    const selector = isDark ? ".dark" : ":root";
    const lines = getAllKeys()
      .map((key) => {
        const v = readCssVar(key);
        return v ? `  ${key}: ${v};` : null;
      })
      .filter(Boolean)
      .join("\n");
    navigator.clipboard.writeText(`${selector} {\n${lines}\n}`);
  }, []);

  // Draggable trigger
  const dragRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ x: -1, y: -1 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (pos.x === -1)
      setPos({ x: window.innerWidth - 100, y: window.innerHeight - 150 });
  }, [pos.x]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    dragOffset.current = {
      x: e.clientX - (dragRef.current?.getBoundingClientRect().left ?? 0),
      y: e.clientY - (dragRef.current?.getBoundingClientRect().top ?? 0),
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - 56, e.clientX - dragOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 56, e.clientY - dragOffset.current.y)),
    });
  }, []);
  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const radius = parseFloat(overrides["--radius"]?.replace("rem", "") || values["--radius"]?.replace("rem", "") || "0.625");
  const letterSpacing = parseFloat(overrides["--letter-spacing"]?.replace("em", "") || values["--letter-spacing"]?.replace("em", "") || "0");
  const spacing = parseFloat(overrides["--spacing"]?.replace("rem", "") || values["--spacing"]?.replace("rem", "") || "0.25");

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          ref={dragRef}
          className="fixed z-[99999] flex items-center gap-1.5 rounded-full border-2 border-primary bg-primary text-primary-foreground px-3 py-2 shadow-xl cursor-grab active:cursor-grabbing select-none text-xs font-bold"
          style={{ left: pos.x, top: pos.y }}
          title="Theme Customizer"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <Palette className="size-4" />
          Theme
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[360px] p-0 z-[99999]">
        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Theme Customizer</SheetTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="size-8" onClick={handleCopy} title="Copy CSS">
                <Copy className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8" onClick={handleReset} title="Reset all">
                <RotateCcw className="size-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-60px)]">
          <div className="p-4">
            {/* Theme Presets */}
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Themes</h3>
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={randomPreset}>
                  <Dices className="size-3" />
                  Random
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {THEME_PRESETS.map((preset, i) => (
                  <button
                    key={preset.label}
                    onClick={() => applyPreset(i)}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <div className="flex gap-0.5">
                      {["--primary", "--secondary", "--accent", "--destructive"].map((k) => (
                        <div key={k} className="size-4 rounded-sm border" style={{ backgroundColor: preset.colors[k] }} />
                      ))}
                    </div>
                    <span className="truncate font-medium">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="colors" className="w-full">
              <TabsList className="mb-3 grid w-full grid-cols-3">
                <TabsTrigger value="colors" className="cursor-pointer text-xs">Colors</TabsTrigger>
                <TabsTrigger value="typography" className="cursor-pointer text-xs">Typography</TabsTrigger>
                <TabsTrigger value="other" className="cursor-pointer text-xs">Other</TabsTrigger>
              </TabsList>

              {/* Colors Tab */}
              <TabsContent value="colors">
                <Accordion type="multiple" defaultValue={["brand", "sidebar"]} className="w-full space-y-3">
                  {COLOR_GROUPS.map((group) => (
                    <AccordionItem key={group.key} value={group.key} className="rounded-lg border px-3">
                      <AccordionTrigger className="cursor-pointer py-2.5 text-sm font-medium">
                        {group.label}
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pb-3">
                        {group.vars.map((v) => (
                          <ColorSwatch
                            key={v.key}
                            label={v.label}
                            cssVar={v.key}
                            value={overrides[v.key] || values[v.key] || ""}
                            onChange={(hex) => handleChange(v.key, hex)}
                          />
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </TabsContent>

              {/* Typography Tab */}
              <TabsContent value="typography">
                <FontSelect
                  label="Sans-Serif Font"
                  category="sans"
                  value={overrides["--font-sans"] || values["--font-sans"] || ""}
                  onChange={(v) => handleChange("--font-sans", v)}
                />
                <FontSelect
                  label="Serif Font"
                  category="serif"
                  value={overrides["--font-serif"] || values["--font-serif"] || ""}
                  onChange={(v) => handleChange("--font-serif", v)}
                />
                <FontSelect
                  label="Monospace Font"
                  category="mono"
                  value={overrides["--font-mono"] || values["--font-mono"] || ""}
                  onChange={(v) => handleChange("--font-mono", v)}
                />
                <div className="mt-4">
                  <SliderWithInput
                    value={letterSpacing}
                    onChange={(v) => handleChange("--letter-spacing", `${v}em`)}
                    min={-0.25}
                    max={0.25}
                    step={0.025}
                    unit="em"
                    label="Letter Spacing"
                  />
                </div>
              </TabsContent>

              {/* Other Tab */}
              <TabsContent value="other">
                <SliderWithInput
                  value={radius}
                  onChange={(v) => handleChange("--radius", `${v}rem`)}
                  min={0}
                  max={2.5}
                  step={0.025}
                  unit="rem"
                  label="Radius"
                />
                <div className="mt-4">
                  <SliderWithInput
                    value={spacing}
                    onChange={(v) => handleChange("--spacing", `${v}rem`)}
                    min={0.15}
                    max={0.35}
                    step={0.01}
                    unit="rem"
                    label="Spacing"
                  />
                </div>
                <div className="mt-4">
                  <ShadowControl
                    shadowColor={overrides["--shadow-color"] || values["--shadow-color"] || "#000000"}
                    shadowOpacity={parseFloat(overrides["--shadow-opacity"] || values["--shadow-opacity"] || "0.1")}
                    shadowBlur={parseFloat((overrides["--shadow-blur"] || values["--shadow-blur"] || "0").replace("px", ""))}
                    shadowSpread={parseFloat((overrides["--shadow-spread"] || values["--shadow-spread"] || "0").replace("px", ""))}
                    shadowOffsetX={parseFloat((overrides["--shadow-offset-x"] || values["--shadow-offset-x"] || "0").replace("px", ""))}
                    shadowOffsetY={parseFloat((overrides["--shadow-offset-y"] || values["--shadow-offset-y"] || "0").replace("px", ""))}
                    onChange={(key, value) => {
                      if (key === "shadow-color" || key === "shadow-opacity") {
                        handleChange(`--${key}`, String(value));
                      } else {
                        handleChange(`--${key}`, `${value}px`);
                      }
                    }}
                    ColorSwatch={ColorSwatch}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

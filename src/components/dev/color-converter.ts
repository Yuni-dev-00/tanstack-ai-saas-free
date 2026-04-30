import chroma from "chroma-js";

export type ColorFormat = "hsl" | "rgb" | "oklch" | "hex";

const formatNumber = (num: number, precision = 2) =>
  Number.isInteger(num) ? num.toString() : num.toFixed(precision);

export function colorFormatter(
  colorValue: string,
  format: ColorFormat = "oklch",
): string {
  try {
    let alpha = 1;
    let processedColor = colorValue;

    if (colorValue.startsWith("#") && colorValue.length === 9) {
      alpha = parseInt(colorValue.slice(7, 9), 16) / 255;
      processedColor = colorValue.slice(0, 7);
    } else if (colorValue.includes("/")) {
      const percentMatch = colorValue.match(/\/\s*([\d.]+)%?/);
      if (percentMatch?.[1]) {
        alpha = percentMatch[1].includes(".")
          ? parseFloat(percentMatch[1])
          : parseInt(percentMatch[1]) / 100;
      }
    }

    if (
      colorValue.startsWith("oklch(") ||
      colorValue.startsWith("lab(") ||
      colorValue.startsWith("lch(")
    ) {
      if (format === "hex") {
        try {
          const c = chroma(colorValue);
          return alpha < 1
            ? c.alpha(alpha).hex()
            : c.hex();
        } catch {
          return colorValue;
        }
      }
      return colorValue;
    }

    const color = chroma(processedColor);
    try {
      color.rgb();
    } catch {
      return colorValue;
    }

    switch (format) {
      case "hex":
        return alpha < 1
          ? color.hex().slice(0, 7) +
              Math.round(alpha * 255)
                .toString(16)
                .padStart(2, "0")
          : color.hex();
      case "oklch": {
        const [l, c, h] = color.oklch();
        if (c < 0.002)
          return alpha < 1
            ? `oklch(${formatNumber(l)} 0 0 / ${Math.round(alpha * 100)}%)`
            : `oklch(${formatNumber(l)} 0 0)`;
        return alpha < 1
          ? `oklch(${formatNumber(l)} ${formatNumber(c)} ${formatNumber(h)} / ${Math.round(alpha * 100)}%)`
          : `oklch(${formatNumber(l)} ${formatNumber(c)} ${formatNumber(h)})`;
      }
      default:
        return colorValue;
    }
  } catch {
    return colorValue;
  }
}

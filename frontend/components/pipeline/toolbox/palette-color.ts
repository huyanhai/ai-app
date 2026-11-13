export type PaletteColorMode = "custom" | "analogous" | "complementary" | "triadic";

export type HsvColor = { h: number; s: number; v: number };

const normalizeHue = (hue: number) => ((hue % 360) + 360) % 360;

export function hsvToRgb(hue: number, saturation: number, value: number) {
  const chroma = value * saturation;
  const section = normalizeHue(hue) / 60;
  const intermediate = chroma * (1 - Math.abs((section % 2) - 1));
  const [red, green, blue] =
    section < 1 ? [chroma, intermediate, 0] :
    section < 2 ? [intermediate, chroma, 0] :
    section < 3 ? [0, chroma, intermediate] :
    section < 4 ? [0, intermediate, chroma] :
    section < 5 ? [intermediate, 0, chroma] : [chroma, 0, intermediate];
  const match = value - chroma;
  return [red, green, blue].map((channel) => Math.round((channel + match) * 255));
}

export function hsvToHex(hue: number, saturation: number, value: number) {
  return `#${hsvToRgb(hue, saturation, value)
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

export function hexToHsv(hex: string): HsvColor {
  const normalized = /^#[0-9A-F]{6}$/i.test(hex) ? hex : "#000000";
  const red = parseInt(normalized.slice(1, 3), 16) / 255;
  const green = parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = parseInt(normalized.slice(5, 7), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;
  if (delta) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  return {
    h: normalizeHue(hue),
    s: maximum ? delta / maximum : 0,
    v: maximum,
  };
}

export function contrastingText(hex: string) {
  const normalized = /^#[0-9A-F]{6}$/i.test(hex) ? hex : "#000000";
  const red = parseInt(normalized.slice(1, 3), 16);
  const green = parseInt(normalized.slice(3, 5), 16);
  const blue = parseInt(normalized.slice(5, 7), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 160 ? "#111111" : "#FFFFFF";
}

export function harmonizePalette(
  colors: string[],
  baseIndex: number,
  baseColor: string,
  mode: PaletteColorMode,
) {
  if (mode === "custom") {
    return colors.map((color, index) => index === baseIndex ? baseColor : color);
  }
  const base = hexToHsv(baseColor);
  return colors.map((color, index) => {
    if (index === baseIndex) return baseColor;
    if (mode === "analogous") {
      const offsets = [0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150];
      return hsvToHex(base.h + (offsets[index] ?? 0), base.s, base.v);
    }
    if (mode === "complementary") {
      const variants = [0, 0, 3, 3, 6, 6, 9, 9, 3, 3, 3];
      const variant = hexToHsv(colors[Math.min(variants[index] ?? index, colors.length - 1)]);
      const darker = index === 8 || index === 9;
      return hsvToHex(
        base.h + (index % 2) * 180,
        darker ? Math.min(1, variant.s * 1.24) : variant.s,
        darker ? variant.v * 0.73 : variant.v,
      );
    }
    const offset = [0, 120, -120][index % 3];
    const current = hexToHsv(color);
    return hsvToHex(base.h + offset, current.s, current.v);
  });
}

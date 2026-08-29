/**
 * MOLIVE 브랜드 컬러 테마입니다.
 *
 * 사용자가 입력한 brand main color 하나에서 결정적으로 색 램프를 만들고,
 * 렌더러가 그대로 소비할 수 있는 CSS를 생성합니다.
 *
 * 설계 원칙: AI 준수에 기대지 않습니다. AI가 브랜드 색을 무시해도 여기서 만든
 * 변수와 규칙이 Preview와 Cafe24 export 양쪽에 그대로 실려 색이 화면에 남습니다.
 * 브랜드 색을 강제하는 재시도 validator는 만들지 않습니다.
 *
 * 안정성 경계: 변수는 전부 `--molive-` 전용 namespace이며 `[data-moire-root]`에만 선언합니다.
 * `:root`/`html`/`body`에는 선언하지 않고, theme-bridge가 소유한 기존 `--moire-*`
 * (card/thumb/header-gap/icon-size/footer-ink/footer-icon-filter)는 선언도 재정의도 하지 않습니다.
 * HeaderV1(commerceCss)과 verified ProductSectionV1의 CSS는 `--molive-*`를 하나도 읽지 않으므로
 * 이 모듈이 만들어 내는 어떤 값도 그 둘의 외형을 바꾸지 않습니다.
 */

export const COLOR_STRATEGIES = ["dominant", "band", "accent-only", "duotone", "monochrome"] as const;
export type ColorStrategy = (typeof COLOR_STRATEGIES)[number];

export const SURFACE_FAMILIES = ["white", "warm", "cool", "tinted", "dark"] as const;
export type SurfaceFamily = (typeof SURFACE_FAMILIES)[number];

export type BrandPalette = {
  brandColor: string;
  colorStrategy: ColorStrategy;
  surfaceFamily: SurfaceFamily;
};

/** theme-bridge가 소유하는 기존 변수입니다. 이 모듈은 절대 선언하지 않습니다. */
export const RESERVED_MOIRE_VARIABLES = [
  "--moire-card-min",
  "--moire-card-gap",
  "--moire-card-pad",
  "--moire-card-radius",
  "--moire-card-font",
  "--moire-thumb-ratio",
  "--moire-thumb-fit",
  "--moire-thumb-bg",
  "--moire-header-gap",
  "--moire-icon-size",
  "--moire-footer-ink",
  "--moire-footer-icon-filter",
] as const;

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** #rgb 또는 #rrggbb만 받습니다. 그 밖의 표기는 브랜드 색으로 인정하지 않습니다. */
export function parseHex(value: string | undefined | null): Rgb | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.split("").map((char) => char + char).join("") : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb) {
  const part = (channel: number) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const l = (max + min) / 2;
  if (delta === 0) return { h: 0, s: 0, l };
  const s = delta / (1 - Math.abs(2 * l - 1));
  const hue = max === red
    ? 60 * (((green - blue) / delta) % 6)
    : max === green
      ? 60 * ((blue - red) / delta + 2)
      : 60 * ((red - green) / delta + 4);
  return { h: (hue + 360) % 360, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const sector = ((((h % 360) + 360) % 360)) / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const channels: [number, number, number] = sector < 1 ? [chroma, second, 0]
    : sector < 2 ? [second, chroma, 0]
      : sector < 3 ? [0, chroma, second]
        : sector < 4 ? [0, second, chroma]
          : sector < 5 ? [second, 0, chroma]
            : [chroma, 0, second];
  const match = l - chroma / 2;
  return { r: (channels[0] + match) * 255, g: (channels[1] + match) * 255, b: (channels[2] + match) * 255 };
}

function fromHsl(hsl: Hsl) {
  return toHex(hslToRgb({ h: hsl.h, s: clamp(hsl.s, 0, 1), l: clamp(hsl.l, 0, 1) }));
}

/** WCAG 상대 휘도입니다. 텍스트 대비 판정에만 씁니다. */
export function relativeLuminance({ r, g, b }: Rgb) {
  const channel = (value: number) => {
    const ratio = value / 255;
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(left: Rgb, right: Rgb) {
  const a = relativeLuminance(left);
  const b = relativeLuminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const LIGHT_ON = "#ffffff";
const DARK_ON = "#141310";

/** 배경 위에 올릴 텍스트 색을 대비가 큰 쪽으로 고릅니다. */
export function onColor(background: string) {
  const rgb = parseHex(background);
  if (!rgb) return DARK_ON;
  const light = contrastRatio(rgb, parseHex(LIGHT_ON) as Rgb);
  const dark = contrastRatio(rgb, parseHex(DARK_ON) as Rgb);
  return light >= dark ? LIGHT_ON : DARK_ON;
}

/** 채도가 이보다 낮으면 hue 회전이 의미가 없어 무채색으로 다룹니다. */
export const ACHROMATIC_SATURATION = 0.08;

/**
 * duotone의 2차 색을 brand color 하나에서 결정적으로 파생합니다.
 * 사용자에게 색 입력을 하나 더 요구하지 않기 위한 규칙이며, 같은 입력은 항상 같은 결과를 냅니다.
 * 보색(180도)은 진동이 심해 150도 스플릿 보색을 쓰고, 채도를 살짝 낮춰 본색이 주인공 자리를 지키게 합니다.
 */
export function deriveSecondary(brandColor: string): string | null {
  const rgb = parseHex(brandColor);
  if (!rgb) return null;
  const hsl = rgbToHsl(rgb);
  // 무채색 입력은 hue를 돌려도 같은 회색이라, 명도만 벌린 중성색으로 파생합니다.
  if (hsl.s < ACHROMATIC_SATURATION) {
    const l = hsl.l > 0.5 ? clamp(hsl.l - 0.28, 0.12, 0.9) : clamp(hsl.l + 0.28, 0.1, 0.88);
    return fromHsl({ h: hsl.h, s: hsl.s, l });
  }
  return fromHsl({
    h: (hsl.h + 150) % 360,
    s: clamp(hsl.s * 0.85, 0.18, 0.72),
    l: clamp(hsl.l, 0.38, 0.62),
  });
}

export type BrandRamp = {
  brand: string;
  strong: string;
  tint: string;
  soft: string;
  secondary: string;
  secondaryTint: string;
  on: string;
  neutralInk: string;
  neutralInkOn: string;
  line: string;
  raised: string;
};

/** brand color 하나에서 페이지가 쓰는 색을 전부 파생합니다. */
export function brandRamp(brandColor: string): BrandRamp | null {
  const rgb = parseHex(brandColor);
  if (!rgb) return null;
  const brand = toHex(rgb);
  const hsl = rgbToHsl(rgb);
  const secondary = deriveSecondary(brand) ?? brand;
  const secondaryHsl = rgbToHsl(parseHex(secondary) as Rgb);
  return {
    brand,
    strong: fromHsl({ h: hsl.h, s: clamp(hsl.s * 1.05, 0, 1), l: clamp(hsl.l * 0.72, 0.14, 0.5) }),
    tint: fromHsl({ h: hsl.h, s: clamp(hsl.s * 0.55, 0.04, 0.5), l: 0.94 }),
    soft: fromHsl({ h: hsl.h, s: clamp(hsl.s * 0.7, 0.05, 0.6), l: 0.87 }),
    secondary,
    secondaryTint: fromHsl({ h: secondaryHsl.h, s: clamp(secondaryHsl.s * 0.55, 0.04, 0.5), l: 0.94 }),
    on: onColor(brand),
    neutralInk: fromHsl({ h: hsl.h, s: clamp(hsl.s * 0.18, 0, 0.14), l: 0.11 }),
    neutralInkOn: fromHsl({ h: hsl.h, s: clamp(hsl.s * 0.1, 0, 0.08), l: 0.95 }),
    line: fromHsl({ h: hsl.h, s: clamp(hsl.s * 0.2, 0.02, 0.16), l: 0.87 }),
    raised: fromHsl({ h: hsl.h, s: clamp(hsl.s * 0.14, 0.02, 0.12), l: 0.975 }),
  };
}

/**
 * colorStrategy가 푸터까지 브랜드를 입힐지 결정합니다.
 * 모든 몰의 푸터가 같은 브랜드 블록이 되어 다시 획일화되는 것을 막는 분기입니다.
 * 푸터 CSS는 계산된 리터럴 hex를 쓰고 `--molive-*` 변수를 참조하지 않습니다.
 */
export function footerBrandBackground(palette: BrandPalette | null | undefined): string | null {
  if (!palette) return null;
  const ramp = brandRamp(palette.brandColor);
  if (!ramp) return null;
  if (palette.colorStrategy === "dominant") return ramp.brand;
  if (palette.colorStrategy === "band") return ramp.tint;
  // accent-only / duotone / monochrome은 기존 footerMood를 그대로 둡니다.
  return null;
}

/**
 * surfaceFamily가 실제로 소비되는 자리입니다.
 *
 * 지금까지 surfaceFamily는 PagePlan에만 있고 렌더러 소비처가 없어, 세 몰의 지면이
 * 전부 warm ivory로 수렴해도 코드가 개입할 방법이 없었습니다.
 * 여기서 base surface 토큰을 결정적으로 만들고, brand hue를 섞어 브랜드와 어긋나지 않게 합니다.
 *
 * 이 토큰은 hard axis가 아닙니다. tone=light 폴백과 바깥 shell 배경, 그리고 계약 텍스트가 씁니다.
 * (AI가 섹션 배경을 직접 디자인하면 그쪽이 이깁니다 — 의도된 우선권입니다.)
 */
export type SurfaceTokens = { surface: string; surfaceInk: string; raised: string; line: string };

export function surfaceTokens(family: SurfaceFamily, brandColor: string): SurfaceTokens {
  const rgb = parseHex(brandColor);
  const hue = rgb ? rgbToHsl(rgb).h : 40;
  const saturation = rgb ? rgbToHsl(rgb).s : 0.2;
  switch (family) {
    case "white":
      return { surface: "#ffffff", surfaceInk: "#17171a", raised: fromHsl({ h: hue, s: 0.02, l: 0.975 }), line: fromHsl({ h: hue, s: 0.04, l: 0.9 }) };
    case "warm":
      return { surface: fromHsl({ h: clampHue(hue, 20, 45), s: 0.34, l: 0.965 }), surfaceInk: fromHsl({ h: clampHue(hue, 20, 45), s: 0.16, l: 0.14 }), raised: "#ffffff", line: fromHsl({ h: clampHue(hue, 20, 45), s: 0.14, l: 0.88 }) };
    case "cool":
      return { surface: fromHsl({ h: clampHue(hue, 190, 225), s: 0.14, l: 0.965 }), surfaceInk: fromHsl({ h: clampHue(hue, 190, 225), s: 0.16, l: 0.13 }), raised: "#ffffff", line: fromHsl({ h: clampHue(hue, 190, 225), s: 0.1, l: 0.88 }) };
    case "tinted":
      return { surface: fromHsl({ h: hue, s: clamp(saturation * 0.3, 0.05, 0.28), l: 0.955 }), surfaceInk: fromHsl({ h: hue, s: 0.18, l: 0.13 }), raised: "#ffffff", line: fromHsl({ h: hue, s: clamp(saturation * 0.24, 0.04, 0.2), l: 0.87 }) };
    case "dark":
    default:
      return { surface: fromHsl({ h: hue, s: clamp(saturation * 0.2, 0, 0.1), l: 0.12 }), surfaceInk: fromHsl({ h: hue, s: 0.05, l: 0.94 }), raised: fromHsl({ h: hue, s: clamp(saturation * 0.16, 0, 0.09), l: 0.18 }), line: fromHsl({ h: hue, s: clamp(saturation * 0.14, 0, 0.08), l: 0.28 }) };
  }
}

/** 무드 계열을 유지하되 브랜드 hue를 그 계열 안으로 끌어옵니다. */
function clampHue(hue: number, min: number, max: number) {
  return hue >= min && hue <= max ? hue : (min + max) / 2;
}

export type BrandThemeOptions = { radius?: string };

/**
 * 브랜드 색 변수를 선언하는 CSS입니다.
 *
 * `[data-moire-root]`에만 선언합니다. `#wrap`이 이 속성을 갖고 header/contents/footer를
 * 전부 감싸므로 변수 자체는 페이지 전역에 닿지만, HeaderV1과 verified ProductSection의 CSS는
 * `--molive-*`를 하나도 읽지 않으므로 그 둘의 외형은 변하지 않습니다.
 */
export function brandThemeCss(palette: BrandPalette | null | undefined, options: BrandThemeOptions = {}) {
  const ramp = palette ? brandRamp(palette.brandColor) : null;
  if (!palette || !ramp) return "";
  const radius = typeof options.radius === "string" && options.radius.trim() ? options.radius.trim() : "0px";
  const surface = surfaceTokens(palette.surfaceFamily, palette.brandColor);
  const declarations = [
    `--molive-brand:${ramp.brand}`,
    `--molive-brand-strong:${ramp.strong}`,
    `--molive-brand-tint:${ramp.tint}`,
    `--molive-brand-soft:${ramp.soft}`,
    `--molive-brand-secondary:${ramp.secondary}`,
    `--molive-brand-secondary-tint:${ramp.secondaryTint}`,
    `--molive-brand-on:${ramp.on}`,
    `--molive-neutral-ink:${ramp.neutralInk}`,
    `--molive-neutral-ink-on:${ramp.neutralInkOn}`,
    // 아래 세 값은 surfaceFamily가 정합니다. 지면 성격이 실제 색으로 바뀌는 유일한 경로입니다.
    `--molive-surface:${surface.surface}`,
    `--molive-surface-ink:${surface.surfaceInk}`,
    `--molive-line:${surface.line}`,
    `--molive-raised:${surface.raised}`,
    `--molive-radius:${radius}`,
  ].join(";");
  return `/* MOLIVE brand theme. 사용자 brand color에서 코드가 결정적으로 파생합니다. */\n[data-moire-root]{${declarations}}`;
}

/** page plan 안의 palette를 런타임에 확인합니다. 형태가 맞지 않으면 없는 것으로 봅니다. */
function readPlannedPalette(pagePlan: unknown): BrandPalette | null {
  if (!pagePlan || typeof pagePlan !== "object") return null;
  const palette = (pagePlan as { palette?: unknown }).palette;
  if (!palette || typeof palette !== "object") return null;
  const candidate = palette as Partial<BrandPalette>;
  const rgb = parseHex(candidate.brandColor);
  if (!rgb) return null;
  const colorStrategy = COLOR_STRATEGIES.includes(candidate.colorStrategy as ColorStrategy) ? candidate.colorStrategy as ColorStrategy : "accent-only";
  const surfaceFamily = SURFACE_FAMILIES.includes(candidate.surfaceFamily as SurfaceFamily) ? candidate.surfaceFamily as SurfaceFamily : "white";
  return { brandColor: toHex(rgb), colorStrategy, surfaceFamily };
}

/**
 * 프로젝트에서 브랜드 팔레트를 꺼냅니다.
 *
 * page plan의 palette가 있으면 그것이 진실입니다(사용자 입력 hex가 여기에 확정 저장됩니다).
 * palette가 없는 기존 프로젝트는 commerce.accent를 브랜드 색으로 읽되,
 * 전략은 가장 절제된 accent-only로 잡아 **푸터를 포함한 기존 외형이 바뀌지 않게** 합니다.
 */
export function resolveProjectPalette(source: {
  commerce?: { accent?: string } | null;
  /**
   * page plan은 palette를 아직 갖지 않는 기존 프로젝트도 있어 unknown으로 받고 런타임에 좁힙니다.
   * palette 필드가 스키마에 들어온 뒤에도 legacy plan에는 여전히 없으므로 이 방어는 유지합니다.
   */
  pagePlan?: unknown;
} | null | undefined): BrandPalette | null {
  const planned = readPlannedPalette(source?.pagePlan);
  if (planned) return planned;
  const accent = source?.commerce?.accent;
  if (!parseHex(accent)) return null;
  return { brandColor: toHex(parseHex(accent) as Rgb), colorStrategy: "accent-only", surfaceFamily: "white" };
}

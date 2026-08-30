const SEMANTIC_COLOR = /^(?:inherit|currentcolor)$/i;

function clampChannel(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function channelHex(value: number) {
  return clampChannel(value).toString(16).padStart(2, "0");
}

function alphaNumber(value: string | undefined) {
  if (value === undefined) return 1;
  const trimmed = value.trim();
  const parsed = trimmed.endsWith("%") ? Number.parseFloat(trimmed) / 100 : Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : null;
}

function colorChannel(value: string) {
  const trimmed = value.trim();
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return clampChannel(trimmed.endsWith("%") ? parsed * 2.55 : parsed);
}

function rgbaValue(red: number, green: number, blue: number, alpha: number) {
  if (alpha === 0) return "transparent";
  if (alpha === 1) return `#${channelHex(red)}${channelHex(green)}${channelHex(blue)}`;
  return `rgba(${clampChannel(red)}, ${clampChannel(green)}, ${clampChannel(blue)}, ${Number(alpha.toFixed(3))})`;
}

/** CSS hex/rgb/rgba를 Editor에서 안정적으로 표시할 값으로 정규화합니다. 의미가 있는 키워드는 보존합니다. */
export function normalizeEditorColor(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  if (/^transparent$/i.test(trimmed)) return "transparent";
  if (SEMANTIC_COLOR.test(trimmed) || /^var\(/i.test(trimmed)) return trimmed;

  const hex = trimmed.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex) {
    const expanded = hex.length <= 4 ? [...hex].map((part) => `${part}${part}`).join("") : hex;
    if (expanded.length === 6) return `#${expanded.toLowerCase()}`;
    if (expanded.length === 8) {
      const alpha = Number.parseInt(expanded.slice(6, 8), 16) / 255;
      return rgbaValue(Number.parseInt(expanded.slice(0, 2), 16), Number.parseInt(expanded.slice(2, 4), 16), Number.parseInt(expanded.slice(4, 6), 16), alpha);
    }
  }

  const functional = trimmed.match(/^rgba?\((.*)\)$/i)?.[1];
  if (functional) {
    const slash = functional.split("/");
    const channels = slash[0].includes(",") ? slash[0].split(",") : slash[0].trim().split(/\s+/);
    const legacyAlpha = channels.length === 4 ? channels.pop() : undefined;
    if (channels.length === 3) {
      const rgb = channels.map(colorChannel);
      const alpha = alphaNumber(slash[1] ?? legacyAlpha);
      if (rgb.every((channel): channel is number => channel !== null) && alpha !== null) return rgbaValue(rgb[0], rgb[1], rgb[2], alpha);
    }
  }
  return trimmed;
}

/** inline/user 값이 직접 표현 가능한 색이면 우선하고, 변수·상속은 실제 computed 색으로 해석합니다. */
export function effectiveEditorColor(declared: string | null | undefined, computed: string | null | undefined) {
  const raw = declared?.trim() ?? "";
  if (raw && !SEMANTIC_COLOR.test(raw) && !/^var\(/i.test(raw)) return normalizeEditorColor(raw);
  return normalizeEditorColor(computed) || normalizeEditorColor(raw);
}

/** native color picker가 의미 손실 없이 표현 가능한 RGB swatch입니다. 투명은 picker를 만들지 않습니다. */
export function editorColorPickerHex(value: string | null | undefined) {
  const normalized = normalizeEditorColor(value);
  if (/^#[0-9a-f]{6}$/i.test(normalized)) return normalized.toLowerCase();
  const rgba = normalized.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,/i);
  return rgba ? `#${rgba.slice(1, 4).map((part) => channelHex(Number(part))).join("")}` : null;
}

function normalizedRgba(value: string) {
  const normalized = normalizeEditorColor(value);
  const hex = normalized.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (hex) return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16), 1] as const;
  if (normalized === "transparent") return [0, 0, 0, 0] as const;
  const rgba = normalized.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d*\.?\d+)\s*\)$/i);
  return rgba ? [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), Number(rgba[4])] as const : null;
}

/** 앞쪽 요소부터 조상 순서로 받은 배경을 실제 보이는 한 색으로 합성합니다. 전부 투명이면 의미를 보존합니다. */
export function compositeEditorBackground(layers: readonly string[]) {
  let result = [0, 0, 0, 0] as [number, number, number, number];
  for (const value of [...layers].reverse()) {
    const foreground = normalizedRgba(value);
    if (!foreground) continue;
    const alpha = foreground[3] + result[3] * (1 - foreground[3]);
    if (alpha === 0) continue;
    result = [
      (foreground[0] * foreground[3] + result[0] * result[3] * (1 - foreground[3])) / alpha,
      (foreground[1] * foreground[3] + result[1] * result[3] * (1 - foreground[3])) / alpha,
      (foreground[2] * foreground[3] + result[2] * result[3] * (1 - foreground[3])) / alpha,
      alpha,
    ];
  }
  return rgbaValue(result[0], result[1], result[2], result[3]);
}

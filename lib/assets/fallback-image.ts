/**
 * 이미지가 끝내 로드되지 않을 때 쓰는 안전한 대체 이미지입니다.
 *
 * 브라우저 깨진 이미지 아이콘을 절대 보여주지 않도록, 외부를 참조하지 않는 data: URI로
 * 프로젝트 팔레트를 쓴 조용한 배경을 그립니다. 글자를 넣지 않아 섹션 이미지 자리에 자연스럽게 앉습니다.
 */

export type FallbackPalette = { surface?: string; accent?: string; ink?: string };

/**
 * SVG를 data: URI로 만듭니다.
 * encodeURIComponent는 괄호를 남기는데, CSS url(...) 안에서 괄호가 값을 끊어 버리므로 함께 escape합니다.
 */
export function svgDataUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg).replaceAll("(", "%28").replaceAll(")", "%29")}`;
}

const DEFAULT_PALETTE: Required<FallbackPalette> = { surface: "#efece6", accent: "#cdc7bb", ink: "#4a463f" };

function safeColor(value: string | undefined, fallback: string) {
  return value && /^#[0-9a-f]{3,8}$|^rgb|^hsl/i.test(value.trim()) ? value.trim() : fallback;
}

/** seed마다 각도와 초점을 바꿔 여러 자리에 같은 판이 반복되지 않게 합니다. */
export function createFallbackImage(input: { palette?: FallbackPalette; seed?: number; width?: number; height?: number }) {
  const palette = {
    surface: safeColor(input.palette?.surface, DEFAULT_PALETTE.surface),
    accent: safeColor(input.palette?.accent, DEFAULT_PALETTE.accent),
    ink: safeColor(input.palette?.ink, DEFAULT_PALETTE.ink),
  };
  const seed = Math.abs(Math.trunc(input.seed ?? 0));
  const width = Math.max(1, Math.trunc(input.width ?? 1600));
  const height = Math.max(1, Math.trunc(input.height ?? 1200));
  const angle = 20 + (seed % 5) * 25;
  const focusX = 30 + (seed % 3) * 20;
  const focusY = 32 + (seed % 4) * 14;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" gradientTransform="rotate(${angle})"><stop offset="0%" stop-color="${palette.surface}"/><stop offset="100%" stop-color="${palette.accent}"/></linearGradient><radialGradient id="f" cx="${focusX}%" cy="${focusY}%" r="70%"><stop offset="0%" stop-color="${palette.ink}" stop-opacity="0.16"/><stop offset="100%" stop-color="${palette.ink}" stop-opacity="0"/></radialGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/><rect width="${width}" height="${height}" fill="url(#f)"/></svg>`;
  return svgDataUri(svg);
}

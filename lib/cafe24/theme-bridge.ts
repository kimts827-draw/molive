const NAMED_COLORS: Record<string, [number, number, number]> = {
  white: [255, 255, 255], black: [0, 0, 0], ivory: [255, 255, 240], beige: [245, 245, 220],
  snow: [255, 250, 250], transparent: [255, 255, 255],
};

const LIGHT_INK = "#f5f3ee";
const DARK_INK = "#1b1a17";

function toHex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function mix(background: [number, number, number], foreground: [number, number, number], foregroundRatio: number): [number, number, number] {
  return background.map((channel, index) => channel * (1 - foregroundRatio) + foreground[index] * foregroundRatio) as [number, number, number];
}

function parseColor(value: string): [number, number, number] | null {
  const text = value.trim().toLowerCase();
  const hex = text.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/);
  if (hex) {
    const raw = hex[1];
    const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
  }
  const rgb = text.match(/rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  for (const [name, channels] of Object.entries(NAMED_COLORS)) if (new RegExp(`\\b${name}\\b`).test(text)) return channels;
  return null;
}

function relativeLuminance([r, g, b]: [number, number, number]) {
  const channel = (value: number) => {
    const ratio = Math.min(Math.max(value, 0), 255) / 255;
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function customProperties(css: string) {
  const values = new Map<string, string>();
  for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/gi)) {
    if (!values.has(match[1])) values.set(match[1], match[2].trim());
  }
  return values;
}

/** background:var(--paper)처럼 변수를 거쳐 선언된 색도 따라갑니다. */
function resolveValue(value: string, properties: Map<string, string>, depth = 0): string | null {
  if (depth > 4) return null;
  const reference = value.match(/var\(\s*(--[a-z0-9-]+)\s*(?:,([^)]*))?\)/i);
  if (!reference) return value;
  const referenced = properties.get(reference[1]) ?? reference[2]?.trim();
  return referenced ? resolveValue(referenced, properties, depth + 1) : null;
}

function backgroundOf(body: string, properties: Map<string, string>) {
  const declaration = body.match(/(?:^|;)\s*background(?:-color|-image)?\s*:\s*([^;]+)/i)?.[1];
  if (!declaration) return null;
  const resolved = resolveValue(declaration, properties);
  return resolved ? parseColor(resolved) : null;
}

/** 선택자가 조건에 맞는 규칙 중 가장 마지막에 선언된 배경색을 돌려줍니다. */
function findBackground(css: string, matches: (selector: string) => boolean, properties: Map<string, string>) {
  let found: [number, number, number] | null = null;
  for (const rule of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (!matches(rule[1].trim())) continue;
    const color = backgroundOf(rule[2], properties);
    if (color) found = color;
  }
  return found;
}

/** 테마 루트에 선언된 배경색을 찾습니다. 못 찾으면 밝은 배경으로 봅니다. */
export function resolveThemeBackground(css: string) {
  const properties = customProperties(css);
  const blocks = [...css.matchAll(/\[data-moire-root[^\]]*\]\s*\{([^}]*)\}/gi)];
  for (const block of blocks) {
    const color = backgroundOf(block[1], properties);
    if (color) return color;
  }
  return null;
}

/**
 * 푸터에 실제로 깔리는 배경을 찾습니다.
 * 브리지가 #footer를 투명으로 두므로 렌더링 순서와 같게 footer → wrap → 테마 루트 순으로 올라갑니다.
 */
export function resolveFooterBackground(css: string) {
  const properties = customProperties(css);
  const footer = findBackground(css, (selector) => /#footer\b|\bfooter\b/.test(selector), properties);
  if (footer) return { color: footer, from: "footer" as const };
  const wrap = findBackground(css, (selector) => /#wrap\b/.test(selector), properties);
  if (wrap) return { color: wrap, from: "wrap" as const };
  const root = resolveThemeBackground(css);
  if (root) return { color: root, from: "root" as const };
  return null;
}

/** 푸터에 실제로 깔리는 배경이 어두우면 밝은 글씨, 밝으면 어두운 글씨를 돌려줍니다. */
export function resolveFooterInk(css: string) {
  const background = resolveFooterBackground(css);
  if (!background) return { ink: DARK_INK, luminance: null as number | null, from: "default" as const };
  const luminance = relativeLuminance(background.color);
  return { ink: luminance < 0.45 ? LIGHT_INK : DARK_INK, luminance, from: background.from };
}

/** Footer shell이 AI selector 우선순위에 기대지 않도록 실제 배경과 대비색을 완성된 palette로 고정합니다. */
export function resolveFooterPalette(css: string, brandBackground?: string | null) {
  const resolved = resolveFooterBackground(css);
  // colorStrategy가 dominant/band일 때만 brandBackground가 들어옵니다.
  // 나머지 전략은 null이라 기존 footerMood 배경이 그대로 남고, 모든 몰의 푸터가 같아지지 않습니다.
  const branded = brandBackground ? parseColor(brandBackground) : null;
  const background = branded ?? resolved?.color ?? [246, 246, 246] as [number, number, number];
  const dark = relativeLuminance(background) < 0.45;
  const primary: [number, number, number] = dark ? [245, 243, 238] : [27, 26, 23];
  return {
    background: toHex(background),
    primary: toHex(primary),
    secondary: toHex(mix(background, primary, 0.72)),
    divider: toHex(mix(background, primary, 0.2)),
    iconFilter: dark ? "invert(1) brightness(1.8)" : "none",
    from: branded ? "brand" as const : resolved?.from ?? "default" as const,
  };
}

/** AI CSS 뒤에 배치되어 Cafe24 Footer의 배경·텍스트·링크·divider 대비를 명시적으로 보장합니다. */
export function buildFooterThemeCss(css: string, brandBackground?: string | null) {
  const palette = resolveFooterPalette(css, brandBackground);
  return `/* Moiré Footer palette contract */
/* position:relative가 없으면 Guide layout.css의 #footer:before(bottom:100px)가 initial containing block 기준으로 떠서 PC 뷰포트 상단(Hero)을 가로지릅니다. Preview shell(FOOTER_SHELL_CSS)과 동일하게 footer를 containing block으로 만듭니다. */
[data-moire-root] #footer{position:relative;background:${palette.background};color:${palette.primary}}
[data-moire-root] #footer .inner{box-sizing:border-box;width:calc(100% - 64px);max-width:1280px;margin-left:auto;margin-right:auto;padding-left:0;padding-right:0}
[data-moire-root] #footer .util a,[data-moire-root] #footer .info .title,[data-moire-root] #footer .info__customer .tel,[data-moire-root] #footer .copyright strong,[data-moire-root] #footer .hosting{color:${palette.primary}}
[data-moire-root] #footer .info__address,[data-moire-root] #footer .info__address span,[data-moire-root] #footer .info__address a,[data-moire-root] #footer .info__customer,[data-moire-root] #footer .info__community a,[data-moire-root] #footer .copyright{color:${palette.secondary}}
[data-moire-root] #footer:before,[data-moire-root] #footer .info__customer{border-color:${palette.divider}}
[data-moire-root] #footer .sns img,[data-moire-root] #footer .sns svg{filter:${palette.iconFilter}}
@media all and (max-width:1024px){[data-moire-root] #footer .inner{width:calc(100% - 48px)}}
@media all and (max-width:767px){[data-moire-root] #footer .inner{width:calc(100% - 40px)}}`;
}

/**
 * 홈 전용 스코프입니다.
 * 세부 페이지(#wrap[data-moire-page="sub"])는 밝은 본문 지면을 쓰므로,
 * 어두운 테마 색을 Cafe24 본문에 상속시키는 규칙은 홈에서만 걸립니다.
 */
const HOME = '[data-moire-root]:not([data-moire-page="sub"])';

/** 세부 페이지 본문 지면 스코프입니다. buildSubLayout이 #wrap에 건 표식 하나로만 갈립니다. */
const SUB = '[data-moire-root][data-moire-page="sub"]';

/**
 * Cafe24 세부 페이지(상품 목록·상세·장바구니·주문·마이페이지·회원·게시판)의 본문 지면 계약입니다.
 *
 * 브랜드 테마가 dark일 때 `[data-moire-root]:not([data-moire-static])`(=#wrap)의 배경이
 * 세부 페이지 전체를 덮어 Cafe24 기본 black/gray 텍스트가 읽히지 않았습니다.
 * 텍스트 색을 하나씩 고치는 대신, 헤더·푸터는 브랜드 면으로 두고 #container 한 겹만
 * 밝은 지면으로 고정합니다. 그 위에서 Cafe24 기본 색이 그대로 제 대비를 냅니다.
 *
 * moire-commerce.css(마지막 스타일시트)에 실려 bridge의 투명 배경 규칙을 이깁니다.
 * 브랜드 색은 버튼·active·링크 hover의 accent로만 남습니다.
 */
export function buildSubpageSurfaceCss(options: { canvas?: string; ink?: string } = {}) {
  const canvas = options.canvas ?? "#ffffff";
  const ink = options.ink ?? DARK_INK;
  return `/* Moiré subpage content canvas. Header/Footer는 브랜드 면을 유지하고 본문만 밝은 지면으로 고정합니다. */
${SUB} #container{background-color:${canvas};color:${ink};padding-top:clamp(16px,2.2vw,36px)}
${SUB} #contents,${SUB} #contents .inner{background-color:transparent}
/* overlay 헤더는 홈 Hero 위에 겹치라고 만든 것이라, 밝은 본문 지면 위에서는 흐름 안으로 되돌립니다. */
${SUB} #header.pocHeader--overlay-minimal{position:relative;inset:auto}
${SUB} .moireAnnouncementBar + #header.pocHeader--overlay-minimal{top:auto}
/* 브랜드 색은 본문에서 accent로만 씁니다. 변수가 없는 프로젝트는 Cafe24 기본값으로 되돌아갑니다. */
${SUB} #container [class^="btnSubmit"]{background-color:var(--molive-brand,#000000);border-color:var(--molive-brand,#000000);color:var(--molive-brand-on,#ffffff)}
${SUB} #container .ec-base-tab .menu li.selected a{color:var(--molive-brand,#000000)}
${SUB} #container a:hover{color:var(--molive-brand,${ink})}`;
}

/**
 * Cafe24 모듈 마크업을 MOLIVE 디자인에 맞추는 브리지 CSS입니다.
 * moire.css보다 먼저 실려서 Cafe24 기본값은 이기고 AI 디자인에는 양보합니다.
 * 색은 대부분 상속으로 넘겨 섹션 배경/톤이 그대로 유지됩니다.
 */
export function buildBridgeCss(css: string) {
  const { ink } = resolveFooterInk(css);
  return `/* Moiré ↔ Cafe24 bridge. moire.css가 뒤에 실려 언제든 덮어쓸 수 있습니다. */
[data-moire-root]{--moire-card-min:15rem;--moire-card-gap:1.5rem;--moire-card-pad:0.75rem 0 0;--moire-thumb-ratio:3/4;--moire-thumb-fit:contain;--moire-thumb-bg:transparent;--moire-card-radius:0;--moire-card-font:0.875rem;--moire-header-gap:1rem;--moire-icon-size:1.25rem;--moire-footer-ink:${ink};--moire-footer-icon-filter:${ink === LIGHT_INK ? "invert(1) brightness(1.8)" : "none"}}

/* verified ProductSection은 자체 Guide CSS만 사용합니다. bridge는 카드 내부 layout을 소유하지 않습니다. */

/* 홈 본문에 꽂힌 Cafe24 요소만 테마 색을 따르게 합니다. 세부 페이지는 밝은 지면 위에서 Cafe24 원래 색을 그대로 씁니다. */
${HOME} h1,${HOME} h2,${HOME} h3,${HOME} h4,${HOME} h5,${HOME} h6,
${HOME} p,${HOME} li,${HOME} dt,${HOME} dd,${HOME} th,${HOME} td,
${HOME} span,${HOME} strong,${HOME} em,${HOME} label,${HOME} legend,
${HOME} caption,${HOME} figcaption,${HOME} address,${HOME} a{color:inherit}
${HOME} #container,${HOME} #contents{color:inherit}

${HOME} .ec-base-product,${HOME} .productItem,${HOME} .xans-product-listmain{background:transparent;color:inherit;border:0}
${HOME} .mainTitle,${HOME} .mainTitle h2,${HOME} .mainTitle h2 span{color:inherit;background:transparent}

[data-moire-root] #header .topArea,[data-moire-root] .topArea__statelogon,[data-moire-root] .navigation,[data-moire-root] .navigation__util,[data-moire-root] .navigation__category{display:flex;align-items:center;gap:var(--moire-header-gap)}
[data-moire-root] .topArea__statelogon ul,[data-moire-root] .navigation ul,[data-moire-root] .navigation__util ul{display:flex;align-items:center;gap:var(--moire-header-gap);margin:0;padding:0;list-style:none}
[data-moire-root] #header a,[data-moire-root] .navigation a,[data-moire-root] .topArea__statelogon a{color:inherit;text-decoration:none}
[data-moire-root] #header svg,[data-moire-root] .navigation svg,[data-moire-root] .bottom-nav svg{width:var(--moire-icon-size);height:var(--moire-icon-size)}
[data-moire-root] #header .count,[data-moire-root] .bottom-nav .count{font-size:.75em}

/* 홈은 Preview와 같은 full-width. Cafe24의 #contents/.inner 폭 제한을 해제합니다. */
[data-moire-root] main#contents[data-moire-full]{max-width:none;margin:0;padding:0}

/* 홈에서 Cafe24의 흰 #container/#contents 배경이 어두운 섹션 사이로 비쳐 흰 줄이 보이는 것을 막습니다. */
${HOME} #container,${HOME} #contents,${HOME} #contents .inner{background:transparent}
[data-moire-root] hr.layout,[data-moire-root] hr{display:none}

/* 헤더에 꽂힌 Cafe24 요소는 아이콘과 글자가 한 줄로 붙게 합니다. */
[data-moire-root] [data-cafe24-bind]{display:inline-flex;align-items:center;gap:.4em;white-space:nowrap}
[data-moire-root] [data-cafe24-bind="category"]{gap:var(--moire-header-gap)}
[data-moire-root] [data-cafe24-bind] a,[data-moire-root] [data-cafe24-bind] button{display:inline-flex;align-items:center;gap:.4em;background:none;border:0;padding:0;font:inherit;color:inherit;cursor:pointer;white-space:nowrap}
[data-moire-root] [data-cafe24-bind] > div,[data-moire-root] [data-cafe24-bind] .navigation,[data-moire-root] [data-cafe24-bind] .navigation__util,[data-moire-root] [data-cafe24-bind] .topArea__statelogon{display:inline-flex;align-items:center;gap:var(--moire-header-gap)}
[data-moire-root] [data-cafe24-bind] ul{display:inline-flex;align-items:center;gap:var(--moire-header-gap);margin:0;padding:0;list-style:none}
[data-moire-root] .moire-logo,[data-moire-root] .moire-mall-name{display:inline-flex;align-items:center}

/* 가격 줄 수가 늘어도 카드가 무너지지 않게 합니다. */
[data-moire-root] .moire-products li{display:flex;flex-direction:column;min-width:0}
[data-moire-root] .moire-products [module="product_ListItem"]{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:.15em}
[data-moire-root] .moire-products [module="product_ListItem"] li{display:flex;gap:.35em;flex-wrap:wrap;min-width:0}
[data-moire-root] .moire-products [module="product_ListItem"] strong{font-weight:inherit;opacity:.7}
/* Cafe24가 판매가·할인가·할인기간 등 여러 행을 내보내도 카드가 세로로 늘어지지 않게 간격을 잡습니다. */
[data-moire-root] .moire-products [module="product_ListItem"] *{margin:0;line-height:1.4}
[data-moire-root] .moire-products [module="product_ListItem"] li:empty{display:none}
[data-moire-root] .moire-products img{max-width:100%}

[data-moire-root] #footer a{text-decoration:none}
/* SNS 아이콘은 이미지라 색을 못 바꾸므로 잉크가 밝을 때만 반전시켜 실제 아이콘까지 맞춥니다. */
[data-moire-root] #footer .sns img,[data-moire-root] #footer .sns svg{filter:var(--moire-footer-icon-filter)}
[data-moire-root] #footer .sns a{color:inherit}
`;
}

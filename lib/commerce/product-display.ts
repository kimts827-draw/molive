/**
 * Cafe24 원본 상품 전시 12종입니다.
 *
 * 근거: reference/cafe24-product-grid(6종), reference/cafe24-product-slide(6종)의 skin19 export.
 * 12개 압축본을 전부 풀어 비교한 결과 index.html 한 파일만 다르고, 그 차이는
 *   1) section의 data-ez-layout 토큰
 *   2) <ul class="prdList ..."> 의 클래스 토큰
 * 두 곳뿐입니다. 그래서 이 파일의 id는 Cafe24 토큰을 그대로 씁니다.
 * Editor 저장값 = Preview 클래스 = ZIP 클래스 = 실몰 클래스가 문자열 수준에서 같아집니다.
 *
 * CSS 값은 reference의 layout/basic/css/{ec-base-product,sub_style,main}.css에서
 * 실제로 variant마다 달라지는 선언만 옮긴 것이며, 원본에 없는 크롭(aspect-ratio/object-fit)은
 * 넣지 않습니다. Cafe24는 {$image_medium} 원본 비율을 그대로 흘립니다.
 */

/** verified 선언 뒤층에서만 쓰는 상품 진열 선택자 prefix입니다. */
export const PRODUCT_SCOPE = "[data-moire-root] [data-cafe24-slot] .moireProductSection.ec-base-product";
/** 슬라이드 크롬(화살표·스크롤바)을 감싸는 MOLIVE 소유 wrapper의 선택자 prefix입니다. */
export const PRODUCT_SLIDE_SCOPE = "[data-moire-root] [data-cafe24-slot] .moireProductSlide";

export const PRODUCT_DISPLAY_IDS = [
  "grid3",
  "grid4",
  "grid5",
  "grid3 list_gallery",
  "grid4 list_gallery",
  "grid5 list_gallery",
  "grid3_slide",
  "grid4_slide",
  "grid5_slide",
  "grid3_slide list_gallery",
  "grid4_slide list_gallery",
  "grid5_slide list_gallery",
] as const;

export type ProductDisplayId = (typeof PRODUCT_DISPLAY_IDS)[number];

export type ProductDisplayMode = "grid" | "slide";
export type ProductDisplayStyle = "normal" | "gallery";
export type ProductDisplayColumns = 3 | 4 | 5;

export type ProductDisplay = {
  /** Cafe24 <ul class="prdList ..."> 에 그대로 들어가는 토큰입니다. */
  readonly id: ProductDisplayId;
  readonly mode: ProductDisplayMode;
  readonly style: ProductDisplayStyle;
  readonly columns: ProductDisplayColumns;
  /** Cafe24 ez-item의 data-name 원문입니다. */
  readonly name: string;
  /** Cafe24 section의 data-ez-module 값입니다. */
  readonly module: "product-list-category/2" | "product-list-slide/2";
};

const DISPLAY_NAME: Record<ProductDisplayColumns, { normal: string; gallery: string }> = {
  3: { normal: "일반3단형(PC 3열/MOBILE 2열)", gallery: "이미지강조3단형(PC 3열/MOBILE 2열)" },
  4: { normal: "일반4단형(PC 4열/MOBILE 2열)", gallery: "이미지강조4단형(PC 4열/MOBILE 2열)" },
  5: { normal: "일반5단형(PC 5열/MOBILE 3열)", gallery: "이미지강조5단형(PC 5열/MOBILE 3열)" },
};

function describe(id: ProductDisplayId): ProductDisplay {
  const gallery = id.includes("list_gallery");
  const slide = id.includes("_slide");
  const columns = Number(id.slice(4, 5)) as ProductDisplayColumns;
  return {
    id,
    mode: slide ? "slide" : "grid",
    style: gallery ? "gallery" : "normal",
    columns,
    name: gallery ? DISPLAY_NAME[columns].gallery : DISPLAY_NAME[columns].normal,
    module: slide ? "product-list-slide/2" : "product-list-category/2",
  };
}

export const PRODUCT_DISPLAYS: Record<ProductDisplayId, ProductDisplay> = Object.fromEntries(
  PRODUCT_DISPLAY_IDS.map((id) => [id, describe(id)]),
) as Record<ProductDisplayId, ProductDisplay>;

/** 기존 프로젝트의 기본값입니다. 지금까지 export되던 <ul class="prdList grid4">와 같습니다. */
export const DEFAULT_PRODUCT_DISPLAY: ProductDisplayId = "grid4";

/** verified ProductSectionV1 registry가 계속 받아 온 legacy variant 이름입니다. */
export const LEGACY_GRID_FOUR_VARIANT = "grid-four";

export function isProductDisplayId(value: unknown): value is ProductDisplayId {
  return typeof value === "string" && (PRODUCT_DISPLAY_IDS as readonly string[]).includes(value);
}

/** 저장값·registry variant를 12종 토큰으로 정규화합니다. 모르는 값은 기본값으로 둡니다. */
export function resolveProductDisplay(value: unknown): ProductDisplayId {
  if (isProductDisplayId(value)) return value;
  return DEFAULT_PRODUCT_DISPLAY;
}

export function productDisplayOf(value: unknown): ProductDisplay {
  return PRODUCT_DISPLAYS[resolveProductDisplay(value)];
}

/** Editor 3축 선택을 Cafe24 토큰으로 합성합니다. */
export function composeProductDisplayId(mode: ProductDisplayMode, style: ProductDisplayStyle, columns: ProductDisplayColumns): ProductDisplayId {
  const base = `grid${columns}${mode === "slide" ? "_slide" : ""}`;
  return (style === "gallery" ? `${base} list_gallery` : base) as ProductDisplayId;
}

const P = PRODUCT_SCOPE;
const S = PRODUCT_SLIDE_SCOPE;

/**
 * 슬라이드 화살표를 상품 영역 바깥 여백에 둡니다.
 * reference는 컨테이너(max-width 1680px, width 92%) 기준 left:-70px으로 폭 50px 화살표의
 * 오른쪽 끝이 상품 영역보다 20px 앞에 오게 하고, 여백이 부족해지는 1680px 이하에서 -50px으로 당깁니다.
 * MOLIVE 상품 영역은 calc(100% - 64px) / max-width 1280px이라 좌우 여백이 최소 32px까지 좁아지므로
 * 같은 20px 간격을 유지하되 여백을 넘어서면 0으로 잡아 가로 스크롤이 생기지 않게 합니다.
 */
const ARROW_INSET = "max(0px, max(32px, 50% - 640px) - 70px)";

/**
 * 그리드 열 수입니다. reference layout/basic/css/ec-base-product.css의
 * ul.grid3/grid4/grid5와 main.css의 @media all and (max-width:1024px) 블록을 그대로 옮겼습니다.
 * reference에는 768~1024 전용 단계가 따로 없어 1024 이하가 한 단계입니다.
 */
const GRID_WIDTH: Record<ProductDisplayColumns, { pc: string; under1024: string }> = {
  3: { pc: "33.3333%", under1024: "50%" },
  4: { pc: "25%", under1024: "50%" },
  5: { pc: "20%", under1024: "33.3333%" },
};

/**
 * 슬라이드 카드 폭입니다.
 * PC: reference는 컨테이너 1680px 기준 540/405/320px 고정폭이며, 이는 gap 20px일 때
 *     정확히 N열이 되는 값입니다(3×540+2×20=1660, 4×405+3×20=1680, 5×320+4×20=1680).
 *     MOLIVE 컨테이너는 1280px이므로 같은 산식을 폭에 종속되지 않게 다시 세웁니다.
 * 768~1024: reference에는 이 구간 override가 없어 PC 고정폭이 그대로 남고 3단이 1.3개만 보입니다.
 *     상품 2개 이상과 다음 상품 일부가 보이도록 MOLIVE가 보강한 구간입니다.
 * ≤767: reference sub_style.css의 값을 그대로 씁니다.
 */
const SLIDE_WIDTH: Record<ProductDisplayColumns, { pc: string; tablet: string; mobile: string }> = {
  3: { pc: "calc((100% - 40px) / 3)", tablet: "calc(42% - 10px)", mobile: "calc(40% - 10px)" },
  4: { pc: "calc((100% - 60px) / 4)", tablet: "calc(42% - 10px)", mobile: "calc(40% - 10px)" },
  5: { pc: "calc((100% - 80px) / 5)", tablet: "calc(30% - 10px)", mobile: "calc(29% - 10px)" },
};

/**
 * 상품 카드의 퀵액션(WISH / ADD / OPTION)입니다. 12종 공통이라 처음 이식에서 뺐지만,
 * 그 결과 ec-base-product.css의 기본값(top:12px / right:12px / flex-direction:column)이 그대로 남아
 * 썸네일 우측 상단에 상시 노출되고 하트 버튼과 겹쳤습니다.
 *
 * reference는 같은 파일 뒤에 오는 sub_style.css("상품진열 퀵바아이콘", 55~61행)로
 * 이 기본값을 덮어 hover 오버레이로 바꿉니다. 여기서는 그 규칙만 옮깁니다.
 * ≤1024는 reference와 같이 퀵바를 감춥니다(hover가 없는 화면에서 상시 노출되지 않게).
 *
 * reference와 다른 선언은 pointer-events 한 가지뿐입니다. 원본은 opacity로만 감춰서
 * 숨은 상태의 버튼이 썸네일 링크 위 클릭을 가로채므로, 감춰진 동안에는 클릭을 통과시킵니다.
 *
 * 전시 12종에서만 달라지는 값이 아니라 상품 카드 공통 동작이므로 전시 선택 여부와 무관하게
 * verifiedProductLayoutCss()의 공통 base에서 한 번만 실립니다. 여기서는 정의만 소유합니다.
 */
export function cardQuickActionCss() {
  return `/* 상품 카드 퀵액션: 평상시 숨김 → 카드 hover 시 썸네일 위 중앙 오버레이 (Cafe24 sub_style.css) */
${P} .prdList .icon__box{position:absolute;top:45%;right:0;left:0;z-index:3;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:0;opacity:0;pointer-events:none;transition:all 0.3s}
${P} .prdList > li:hover .icon__box{opacity:1;pointer-events:auto}
${P} .prdList .prdList__item .icon__box > span{position:relative;display:block;box-sizing:border-box;margin:0 3px;min-width:72px;height:auto;padding:10px 15px;border:1px solid #999;border-radius:10px;font-size:11px;font-weight:500;line-height:1;color:#000;background-color:rgba(255,255,255,0.7);cursor:pointer}
${P} .prdList .prdList__item .icon__box > span:hover,
${P} .prdList .prdList__item .icon__box > span.on{color:#fff;background-color:#000;border:1px solid #000}
${P} .prdList .prdList__item .icon__box > span img{position:absolute;top:0;left:0;width:100%;height:100%;opacity:0}
${P} .prdList .thumbnail .badge{display:none}
@media all and (max-width:1024px){${P} .prdList .icon__box{display:none}}`;
}

/** reference sub_style.css의 "상품진열 강조형" 블록입니다. 이미지 크롭은 원본에 없으므로 넣지 않습니다. */
function listGalleryCss() {
  return `/* list_gallery(이미지강조형): 정보를 썸네일 위 오버레이로 올리고 hover 퀵바를 끕니다. */
${P} .prdList > li{margin:0 0 20px}
${P} .prdList .prdList__item{position:relative;overflow:hidden}
${P} .prdList .thumbnail{margin:0}
${P} .prdList .thumbnail .icon{position:absolute;left:0;top:0;bottom:auto;margin:0;font-size:0}
${P} .prdList .description{position:absolute;left:0;right:0;bottom:-20%;z-index:1;margin:0;padding:5% 5% 3% 5%;opacity:0;background-color:rgba(255,255,255,0.8);transition:all 0.3s}
${P} .prdList .description .name span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${P} .prdList > li:hover .description{bottom:0;opacity:1}
${P} .prdList .icon__box{display:none}
@media all and (max-width:1024px){
${P} .prdList > li{margin:0 0 35px}
${P} .prdList .prdList__item{overflow:visible}
${P} .prdList .thumbnail{margin:0 0 10px}
${P} .prdList .thumbnail .icon{position:absolute;left:0;top:auto;bottom:0;margin:0;font-size:0}
${P} .prdList .description{position:static;margin:20px 20px 0 0;padding:0;opacity:1;background-color:transparent}
${P} .prdList .description .name span{display:block;white-space:normal;overflow:visible;text-overflow:unset}
}`;
}

function gridCss(columns: ProductDisplayColumns) {
  const width = GRID_WIDTH[columns];
  return `/* grid${columns}: PC ${columns}열 / 1024 이하 ${width.under1024 === "50%" ? 2 : 3}열 (Cafe24 reference 값) */
${P} .prdList > li{width:${width.pc}}
@media all and (max-width:1024px){${P} .prdList > li{width:${width.under1024}}}`;
}

/**
 * Swiper 4.5.1 기반 슬라이드입니다.
 * base skin(Guide/skin4)은 Swiper 4.5.1을 이미 싣고 있지만 그 .swiper-* CSS가
 * 상품 카드용이 아니라서(예: .swiper-slide{width:100%;display:flex;background:#fff})
 * 필요한 base 선언을 MOLIVE가 직접 소유합니다. Preview에는 skin CSS가 없으므로
 * 이렇게 해야 Preview와 실몰이 같은 그림이 됩니다.
 */
function slideCss(columns: ProductDisplayColumns) {
  const width = SLIDE_WIDTH[columns];
  return `/* grid${columns}_slide: Swiper 4.5.1 slidesPerView:auto, spaceBetween 20(≤768 10) */
${P}.swiper-container{position:relative;z-index:1;overflow:hidden}
${P}.swiper-container.special_slide{padding:0 0 50px 0}
${P} .prdList.swiper-wrapper{position:relative;z-index:1;display:flex;box-sizing:content-box;width:100%;height:auto;margin:0;padding:0;transition-property:transform}
${P} .prdList > li.swiper-slide{flex-shrink:0;display:block;width:${width.pc};height:auto;margin:0 20px 0 0;padding:0;overflow:hidden;text-align:left;background:transparent;vertical-align:top}
${P} .prdList > li.swiper-slide .prdList__item{margin:0}
${P} .prdList > li.swiper-slide .thumbnail{margin:0}
${S}{position:relative;width:100%}
${S} .swiper-scrollbar{position:absolute;left:0;bottom:3px;z-index:50;width:100%;height:2px;border-radius:0;background:rgba(0,0,0,0.1);transition:all 0.3s}
${S} .swiper-scrollbar:hover{height:5px}
${S} .swiper-scrollbar .swiper-scrollbar-drag{position:relative;left:0;top:0;width:100%;height:100%;border-radius:0;background:#1a1a1a;cursor:pointer}
${S} .swiper-prev-special,${S} .swiper-next-special{position:absolute;top:36%;z-index:2;width:50px;height:50px;margin:0;padding:0;border:0;background:transparent;overflow:visible;text-indent:0;font-size:0;color:transparent;transform:none;cursor:pointer}
${S} .swiper-prev-special{left:${ARROW_INSET}}
${S} .swiper-next-special{right:${ARROW_INSET}}
${S} .swiper-prev-special::after,${S} .swiper-next-special::after{content:"";position:absolute;top:50%;left:50%;width:16px;height:16px;border-style:solid;border-color:#1a1a1a;border-width:1px 1px 0 0}
${S} .swiper-prev-special::after{transform:translate(-40%,-50%) rotate(-135deg)}
${S} .swiper-next-special::after{transform:translate(-60%,-50%) rotate(45deg)}
${S} .swiper-button-disabled{opacity:0.35;pointer-events:none}
@media all and (min-width:768px) and (max-width:1024px){${P} .prdList > li.swiper-slide{width:${width.tablet}}}
@media all and (max-width:1024px){${S} .swiper-prev-special,${S} .swiper-next-special{display:none}}
@media all and (max-width:767px){${P} .prdList > li.swiper-slide{width:${width.mobile};margin-right:10px}}`;
}

/**
 * Preview 전용 레이어입니다. DOM·class·Cafe24 module·{$...} binding은 실몰과 완전히 같고,
 * Swiper JS를 실행할 수 없는 Preview iframe(sandbox="allow-same-origin")에서
 * 같은 진열을 확인할 수 있도록 <ul>에 가로 스크롤만 얹습니다.
 */
function slidePreviewCss() {
  return `/* Preview 전용: Swiper 미실행 구간을 같은 DOM 그대로 가로 스크롤로 확인합니다. */
${P} .prdList.swiper-wrapper{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
${P} .prdList > li.swiper-slide{scroll-snap-align:start}`;
}

export type ProductDisplayCssOptions = { target?: "preview" | "cafe24" };

/** 12종 전시의 CSS 뒤층입니다. golden DOM/module/변수 계약은 그대로 두고 진열만 재선언합니다. */
export function productDisplayCss(value: unknown, options: ProductDisplayCssOptions = {}) {
  const display = productDisplayOf(value);
  // 퀵액션은 공통 base(cardQuickActionCss)가 앞서 실리고, 이미지강조형이 뒤에서 그 퀵바를 감춥니다.
  const layers = [display.mode === "slide" ? slideCss(display.columns) : gridCss(display.columns)];
  if (display.style === "gallery") layers.push(listGalleryCss());
  if (display.mode === "slide" && options.target === "preview") layers.push(slidePreviewCss());
  return layers.join("\n");
}

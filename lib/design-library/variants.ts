/**
 * MOLIVE 디자인 variant 라이브러리입니다.
 * reference-patterns.ts의 실제 Cafe24 레퍼런스 패턴을 AI가 그대로 시공할 수 있는
 * 구조 계약(spec)으로 옮긴 것으로, blueprint.ts가 업종·시드에 따라 조합합니다.
 *
 * 안정성 경계: 여기의 variant는 전부 AI 소유 캔버스(Hero/Category/Story/CTA/Footer 무드)만
 * 다룹니다. HeaderV1, verified ProductSectionV1, Cafe24 module/변수 계약은 건드리지 않습니다.
 */

export type VariantKind = "hero" | "category" | "product-context" | "story" | "social" | "cta" | "trust";

export type DesignVariant = {
  id: string;
  kind: VariantKind;
  name: string;
  /** 근거가 되는 reference-patterns.ts 패턴 id */
  basedOn: string[];
  /** AI에게 전달되는 구조 계약. 값이 아니라 구조·비례·앵커를 지시한다. */
  spec: string;
};

/** architecture.hero에 기록되는 hero variant id 목록. 앞의 두 값은 기존 저장 데이터와의 호환 값이다. */
export const HERO_VARIANT_IDS = [
  "full-bleed",
  "split-editorial",
  "banner-stack",
  "typographic-marquee",
  "cinematic-still",
  "product-forward",
] as const;
export type HeroVariantId = (typeof HERO_VARIANT_IDS)[number];

export const HERO_VARIANTS: Record<HeroVariantId, DesignVariant & { id: HeroVariantId }> = {
  "full-bleed": {
    id: "full-bleed",
    kind: "hero",
    name: "풀블리드 키비주얼",
    basedOn: ["hero/keyvisual-slider"],
    spec: "화면 폭 100%를 채우는 단일 대형 비주얼(min-height 72~92svh). 카피 블록은 좌하단 또는 중앙 하단 한 곳에만 앵커하고, 가독을 위해 방향성 있는 어두운 그라디언트 셰이드를 이미지 위에 한 겹 얹는다. 카피는 eyebrow(작은 라벨)+대형 타이틀+한 줄 소개+CTA 링크 1개. 모바일에서는 같은 이미지에 카피가 하단 스택으로 내려앉는다.",
  },
  "split-editorial": {
    id: "split-editorial",
    kind: "hero",
    name: "스플릿 에디토리얼",
    basedOn: ["hero/split-editorial"],
    spec: "카피 컬럼(38~46%)과 비주얼 컬럼(54~62%)의 비대칭 2컬럼 grid(min-height 78~92svh). 카피 컬럼은 세로 중앙 정렬, 비주얼 컬럼은 object-fit:cover 풀 하이트. 카피 컬럼 하단에 인덱스 라벨(01 / …)이나 작은 노트를 두어 잡지 지면처럼 만든다. 모바일에서는 카피 블록 → 4/5 비율 이미지 순서의 세로 스택.",
  },
  "banner-stack": {
    id: "banner-stack",
    kind: "hero",
    name: "갤러리+타일 스택",
    basedOn: ["hero/banner-stack"],
    spec: "상단 대형 갤러리 컷(55~68svh, 카피 오버레이) 바로 아래 서로 다른 이미지의 타일 배너 3장을 붙인 grid(gap 0 또는 아주 좁게). 각 타일에는 짧은 라벨+링크가 오버레이된다. 도입부가 한 컷이 아니라 편집된 보드처럼 보여야 한다. 모바일에서는 갤러리 컷 아래 타일이 가로 스크롤 또는 세로 스택.",
  },
  "typographic-marquee": {
    id: "typographic-marquee",
    kind: "hero",
    name: "타이포그래픽 선언",
    basedOn: ["hero/typographic-statement", "cta/marquee-strip"],
    spec: "이미지 대신 뷰포트 폭의 12~18vw 초대형 브랜드 워드/카피가 주인공인 도입부(배경은 단색 또는 미세한 톤). 타이틀 아래 좁은 이미지 스트립(높이 32~44svh) 또는 오프셋된 사진 1장을 배치해 리듬을 만든다. transform 애니메이션 없이 반복 텍스트를 정적 스트립으로 배치해 marquee의 인상만 가져온다. 모바일에서는 워드마크가 두 줄로 꺾이고 이미지 스트립이 아래로 온다.",
  },
  "cinematic-still": {
    id: "cinematic-still",
    kind: "hero",
    name: "시네마틱 스틸",
    basedOn: ["hero/fullscreen-cinematic"],
    spec: "거의 풀스크린(88~100svh)의 어두운 무드 스틸 1컷. 이미지 위에 저채도·고대비 톤(다크 셰이드)과 중앙 또는 좌측 정렬의 절제된 카피(작은 eyebrow, 굵은 타이틀 1~2줄, 사양·소재 같은 짧은 스펙 라인). 스크롤 유도 표시를 하단에 작게 둔다. video 요소는 금지, 스틸로 시네마틱함을 만든다. 모바일도 풀스크린을 유지하되 카피는 하단 정렬.",
  },
  "product-forward": {
    id: "product-forward",
    kind: "hero",
    name: "상품 우선 컴팩트 배너",
    basedOn: ["hero/product-forward"],
    spec: "높이를 36~52svh로 억제한 컴팩트 배너(카피 좌측, 시선을 끄는 단정한 비주얼 우측 또는 배경). 배너 바로 아래 카테고리 퀵 진입(아이콘/텍스트 칩 6~10개)이 오고, 곧바로 상품 영역으로 이어져 '바로 산다'는 리테일 리듬을 만든다. 모바일에서는 배너가 더 낮아지고 퀵 진입은 가로 스크롤 칩.",
  },
};

export const CATEGORY_VARIANTS: Record<string, DesignVariant> = {
  "quick-menu": {
    id: "quick-menu",
    kind: "category",
    name: "아이콘 퀵메뉴",
    basedOn: ["category/quick-menu"],
    spec: "'무엇을 찾으시나요?' 류의 짧은 안내 카피와 함께 원형/라운드 썸네일+라벨의 카테고리 그리드(PC 6~10개 1행, 모바일 2행 또는 가로 스크롤). 각 항목은 /product/list.html 링크.",
  },
  "collection-tiles": {
    id: "collection-tiles",
    kind: "category",
    name: "컬렉션 타일 카드",
    basedOn: ["category/collection-tiles"],
    spec: "이미지 타일 2~3장(비율 4/5 또는 1/1)에 컬렉션명과 more 링크를 오버레이 또는 하단 캡션으로 얹는 카드 행. 타일 간 여백과 캡션 타이포로 브랜드 톤을 만든다.",
  },
  "editorial-index": {
    id: "editorial-index",
    kind: "category",
    name: "에디토리얼 인덱스",
    basedOn: ["category/editorial-index"],
    spec: "괘선으로 구분된 카테고리명 텍스트 리스트(대형 세리프, 각 행에 01/02 번호 라벨). 헤딩 컬럼+리스트 컬럼의 2컬럼 또는 풀폭 리스트. hover에서 들여쓰기/색 변화만.",
  },
  "tab-free-rail": {
    id: "tab-free-rail",
    kind: "category",
    name: "카테고리 밴드",
    basedOn: ["category/tab-product-rail"],
    spec: "카테고리 이름을 큰 텍스트 칩/밴드로 나열하고 각 칩이 리스트로 링크되는 정적 밴드(JS 탭 전환은 금지이므로 탭의 인상을 칩 나열로 대체). 상품 영역 바로 위에 붙여 진열의 도입부 역할.",
  },
};

export const PRODUCT_CONTEXT_VARIANTS: Record<string, DesignVariant> = {
  "heading-more": {
    id: "heading-more",
    kind: "product-context",
    name: "타이틀+more 프레임",
    basedOn: ["product-context/heading-more"],
    spec: "상품 슬롯 위에 영문 라벨(txt01)+국문 타이틀(txt02) 페어, 아래 또는 우측에 more 링크. 레퍼런스에서 가장 보편적인 진열 프레임.",
  },
  "best-frame": {
    id: "best-frame",
    kind: "product-context",
    name: "베스트 프레임",
    basedOn: ["product-context/best-ranking"],
    spec: "BEST/TOP SELLER 성격의 헤딩과 절제된 부카피로 상품 슬롯을 감싼다. 판매 수치·순위 숫자를 지어내지 않고 헤딩의 무게만 가져온다.",
  },
  "curation-band": {
    id: "curation-band",
    kind: "product-context",
    name: "큐레이션 밴드",
    basedOn: ["product-context/curation-band"],
    spec: "MD 추천/시즌 에디트 성격의 2~3문장 큐레이션 카피 블록이 상품 슬롯을 이끈다. 배경 톤을 페이지와 살짝 달리해 밴드로 인지되게 한다.",
  },
};

export const STORY_VARIANTS: Record<string, DesignVariant> = {
  "split-media": {
    id: "split-media",
    kind: "story",
    name: "스플릿 미디어 스토리",
    basedOn: ["story/split-media"],
    spec: "사진 50~54% + 카피 46~50%의 2컬럼 브랜드 서사(min-height 60~76svh). 카피는 eyebrow+대형 타이틀+본문 2~4문장+텍스트 링크. 소재·공정·철학을 말한다. 모바일은 이미지→카피 스택.",
  },
  "dark-statement": {
    id: "dark-statement",
    kind: "story",
    name: "다크 선언 밴드",
    basedOn: ["story/dark-statement"],
    spec: "어두운 배경 전폭 밴드(min-height 42~60svh)에 큰 카피 1~2줄과 짧은 보조문. 페이지 리듬을 끊는 무게추 역할. 배경은 단색 또는 저채도 이미지+셰이드.",
  },
  "lookbook-row": {
    id: "lookbook-row",
    kind: "story",
    name: "룩북 이미지 행",
    basedOn: ["story/lookbook-row"],
    spec: "캡션 없이(또는 아주 작은 캡션만) 이미지 3~4장을 서로 다른 높이 오프셋으로 나란히 흘리는 행. 설명하지 않는 것이 목적이므로 텍스트는 섹션 라벨 하나까지만.",
  },
};

export const SOCIAL_VARIANTS: Record<string, DesignVariant> = {
  "sns-gallery": {
    id: "sns-gallery",
    kind: "social",
    name: "SNS 갤러리",
    basedOn: ["social/sns-gallery"],
    spec: "정방형 이미지 4~6장의 그리드와 @핸들 라벨. 팔로워 수·좋아요 수 등 수치는 만들지 않는다. 각 셀은 이미지만, hover에 옅은 오버레이.",
  },
  "ugc-strip": {
    id: "ugc-strip",
    kind: "social",
    name: "UGC 스트립",
    basedOn: ["social/review-band"],
    spec: "리뷰 본문을 지어내는 대신 고객 씬 무드의 라이프스타일 컷 3~4장과 'REAL MOMENTS' 성격의 라벨로 사회적 신뢰의 인상만 만든다. 별점·후기 텍스트 금지.",
  },
};

export const CTA_VARIANTS: Record<string, DesignVariant> = {
  "full-campaign": {
    id: "full-campaign",
    kind: "cta",
    name: "풀폭 캠페인",
    basedOn: ["cta/full-campaign"],
    spec: "전폭 이미지(min-height 56~78svh) 위 방향성 셰이드+카피+밑줄형 CTA 링크 1개. 시즌 캠페인/기획전으로 이어지는 문.",
  },
  "statement-text": {
    id: "statement-text",
    kind: "cta",
    name: "텍스트 선언 CTA",
    basedOn: ["cta/statement-text"],
    spec: "이미지 없이 넉넉한 상하 패딩(120px 이상)과 중앙 또는 좌측 정렬 대형 타이포 2~3줄, 아래 텍스트 링크 1개. 배경은 페이지와 한 톤 다른 단색.",
  },
  "promo-duo": {
    id: "promo-duo",
    kind: "cta",
    name: "프로모션 듀오 패널",
    basedOn: ["cta/promo-duo"],
    spec: "반폭 패널 2장(또는 1/3 패널 3장)의 grid. 각 패널은 이미지+라벨+짧은 카피+링크로 서로 다른 기획(선물세트/신상/이벤트)을 병렬 제안. 모바일 세로 스택.",
  },
  "marquee-strip": {
    id: "marquee-strip",
    kind: "cta",
    name: "마퀴 스트립",
    basedOn: ["cta/marquee-strip"],
    spec: "시즌 키워드를 · 로 이어 반복한 한 줄 대형 텍스트 스트립(정적, keyframes 금지). 섹션 사이 전환부에 한 번만 사용.",
  },
};

export const TRUST_VARIANTS: Record<string, DesignVariant> = {
  "spec-band": {
    id: "spec-band",
    kind: "trust",
    name: "스펙/약속 밴드",
    basedOn: ["story/dark-statement", "product-context/heading-more"],
    spec: "3~4개의 짧은 항목(소재/공정/배송·교환 안내 같은 일반적 사실)을 괘선 그리드로 나열하는 정보 밴드. 인증·수상·판매수치 등 검증 불가한 주장 금지.",
  },
  "info-columns": {
    id: "info-columns",
    kind: "trust",
    name: "인포 컬럼",
    basedOn: ["product-context/curation-band"],
    spec: "제품 철학·사용 안내·관리법 같은 도움말 성격의 2~3 컬럼 텍스트 블록. 차분한 타이포와 아이콘 없이 텍스트 위주.",
  },
};

/**
 * HeaderV1 구조 variant 사전입니다. DOM과 기능 contract(로고/카테고리/검색/로그인/카트)는
 * fixed-components.ts의 HeaderV1이 소유하며, 여기의 설명은 blueprint가 업종에 맞는
 * 구조를 고르고 AI가 주변(Hero와의 관계)을 설계할 때 쓰는 계약입니다.
 */
export const HEADER_STRUCTURES = {
  "split-utility": {
    id: "split-utility",
    name: "컴팩트 싱글 로우",
    spec: "낮은 한 줄 헤더(작은 로고 22px, 좌 로고·중 내비·우 유틸). 리테일의 밀도와 속도를 만든다. Hero는 헤더 바로 아래에서 시작한다.",
  },
  "centered-brand": {
    id: "centered-brand",
    name: "라지 브랜드 로우 + 내비 로우",
    spec: "큰 로고(34px)가 중앙에 오는 브랜드 행과 그 아래 중앙 정렬 내비 행의 2단 구조. 브랜드가 먼저 보이는 백화점식 도입. Hero는 두 행 아래에서 시작한다.",
  },
  "overlay-minimal": {
    id: "overlay-minimal",
    name: "Hero 오버레이 미니멀",
    spec: "투명 배경으로 Hero 위에 얹히는 오버레이 헤더(로고 중앙 30px, 넓은 자간). Hero 첫 화면이 헤더 뒤까지 차오르도록 Hero 상단 여백을 설계해야 한다.",
  },
} as const;
export type HeaderStructureId = keyof typeof HEADER_STRUCTURES;

/**
 * verified ProductSectionV1 위에 얹는 presentation variant 사전입니다.
 * DOM·Cafe24 module·변수 계약은 동결이며 fixed-components.ts의 verifiedProductLayoutCss가
 * CSS 뒤층으로만 구현합니다. imagePolicy 근거: Guide skin4/17/18 조사에서 상품 진열의
 * 검증된 리스트 이미지 변수는 {$image_medium}뿐 — 큰 카드는 콘텐츠 폭 캡으로 확대를 막는다.
 */
export const PRODUCT_PRESENTATIONS = {
  "grid-four": {
    id: "grid-four",
    name: "standard 4-grid",
    columns: "PC 4열 / Tablet 3열 / Mobile 2열",
    spec: "검증 기본형. 원본 비율 이미지, 좌측 정렬 정보, 표준 간격(section 최대 1280px).",
    imagePolicy: "{$image_medium} 원본 비율 그대로, 카드폭 약 300px 이하라 확대 없음.",
  },
  "large-grid": {
    id: "large-grid",
    name: "large 3-grid",
    columns: "PC 3열 / Tablet 2열 / Mobile 2열",
    spec: "3열 대형 카드, 4/5 세로 크롭, 행 간격 52px의 라이프스타일 진열.",
    imagePolicy: "{$image_medium}를 4/5로 크롭(object-fit:cover), 카드폭 약 400px로 medium 해상도 범위 내.",
  },
  "editorial-two": {
    id: "editorial-two",
    name: "editorial 2-grid",
    columns: "PC 2열 / Tablet 2열 / Mobile 1열",
    spec: "좁은 section(1040px)에 2열 대형 카드, 3/4 크롭, 중앙 정렬 타이포와 큰 행간(76px)의 에디토리얼 진열.",
    imagePolicy: "카드 콘텐츠 폭을 500px로 캡해 {$image_medium}(기본 500px 내외)이 확대되지 않게 한다.",
  },
  "featured-grid": {
    id: "featured-grid",
    name: "featured + grid",
    columns: "PC 피처 1(50%) + 4열 / Tablet 피처 전폭 + 2열 / Mobile 피처 전폭 + 2열",
    spec: "첫 상품을 4/5 대형 피처로 세우고 나머지를 1/1 그리드로 받치는 큐레이션 진열.",
    imagePolicy: "피처 카드 콘텐츠 폭을 540px로 캡해 {$image_medium} 확대를 막고, 나머지는 1/1 크롭.",
  },
  "compact-five": {
    id: "compact-five",
    name: "compact 5-grid",
    columns: "PC 5열 / Tablet 4열 / Mobile 2열",
    spec: "넓은 section(1440px)에 5열 컴팩트 카드, 1/1 크롭, 11~12px 타이트한 정보 밀도의 리테일 진열.",
    imagePolicy: "{$image_medium}를 1/1로 크롭, 카드폭 약 230px라 축소 표시.",
  },
} as const;
export type ProductPresentationId = keyof typeof PRODUCT_PRESENTATIONS;

/** Cafe24 법정 푸터(footer#footer)에 입힐 무드. 값은 AI CSS가 footer 배경으로 선언하고 palette contract가 마무리한다. */
export const FOOTER_MOODS = {
  "ink-dark": { id: "ink-dark", name: "잉크 다크", basedOn: ["footer/ink-dark"], spec: "footer#footer에 잉크에 가까운 어두운 배경을 선언해 밝은 글자 대비로 마무리한다." },
  "paper-light": { id: "paper-light", name: "페이퍼 라이트", basedOn: ["footer/paper-light"], spec: "footer#footer에 밝은 회백/페이퍼 톤 배경을 선언해 표준적인 인포 푸터로 마무리한다." },
  "warm-tinted": { id: "warm-tinted", name: "웜 틴트", basedOn: ["footer/warm-tinted"], spec: "footer#footer에 브랜드 웜 톤을 옅게 입힌 배경을 선언한다." },
} as const;
export type FooterMoodId = keyof typeof FOOTER_MOODS;

/** 콘텐츠 밀도: 섹션 패딩·행간·컷 수의 총량 계약 */
export const DENSITY_SCALES = {
  airy: "섹션 상하 패딩 110~150px, 본문 최대폭 좁게, 한 화면에 한 가지 이야기만. 여백이 디자인의 절반이다.",
  regular: "섹션 상하 패딩 80~110px, 정보와 여백의 표준 균형.",
  dense: "섹션 상하 패딩 48~80px, 퀵메뉴·정보 밴드 등 단위 요소를 촘촘히. 리테일의 활기를 만들되 정렬은 흐트러뜨리지 않는다.",
} as const;
export type DensityId = keyof typeof DENSITY_SCALES;

/** 타이포 스케일: 디스플레이/본문의 성격 계약 */
export const TYPE_SCALES = {
  "serif-display": "디스플레이는 Georgia 계열 세리프 clamp(44px~84px)·좁은 자간, 본문은 시스템 산세리프 13~15px. 에디토리얼 대비를 크게.",
  "sans-modern": "디스플레이·본문 모두 시스템 산세리프. 디스플레이 clamp(36px~64px)에 -0.02em 자간, 라벨은 넓은 자간 대문자. 정밀하고 기술적인 인상.",
  "rounded-warm": "디스플레이 clamp(34px~56px)의 부드러운 무게(600~700), 행간 넉넉하게. 라벨은 소문자 혼용도 허용. 다정하고 따뜻한 인상.",
} as const;
export type TypeScaleId = keyof typeof TYPE_SCALES;

/** 이미지 처리 계약 */
export const IMAGE_TREATMENTS = {
  "desaturated-editorial": "saturate 0.55~0.75 + 약한 contrast 보정으로 톤을 눌러 잡지 지면처럼. 크롭은 인물/실루엣 중심.",
  "vivid-clean": "보정 없이 밝고 선명하게, 배경이 깨끗한 컷 위주. 흰 여백과 함께 상품이 주인공.",
  "warm-film": "따뜻한 톤(약한 sepia/saturate 상향)과 부드러운 명암. 음식·수공예의 온기를 만든다.",
  "dark-cinematic": "grayscale 0.2~0.5 + contrast 상향의 어두운 룩. 금속·기계·야간 씬과 어울린다.",
} as const;
export type ImageTreatmentId = keyof typeof IMAGE_TREATMENTS;

export const SECTION_VARIANTS: Record<string, DesignVariant> = {
  ...Object.fromEntries(Object.entries(CATEGORY_VARIANTS).map(([key, value]) => [`category/${key}`, value])),
  ...Object.fromEntries(Object.entries(PRODUCT_CONTEXT_VARIANTS).map(([key, value]) => [`products/${key}`, value])),
  ...Object.fromEntries(Object.entries(STORY_VARIANTS).map(([key, value]) => [`story/${key}`, value])),
  ...Object.fromEntries(Object.entries(SOCIAL_VARIANTS).map(([key, value]) => [`social/${key}`, value])),
  ...Object.fromEntries(Object.entries(CTA_VARIANTS).map(([key, value]) => [`cta/${key}`, value])),
  ...Object.fromEntries(Object.entries(TRUST_VARIANTS).map(([key, value]) => [`trust/${key}`, value])),
};

export function sectionVariant(ref: string): DesignVariant {
  const variant = SECTION_VARIANTS[ref];
  if (!variant) throw new Error(`알 수 없는 section variant입니다: ${ref}`);
  return variant;
}

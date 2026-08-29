/**
 * MOLIVE 본문 섹션 레지스트리입니다.
 *
 * Header/Footer는 고정 컴포넌트가 소유하고, 그 사이의 본문은 이 레지스트리의
 * section type을 AI가 골라 순서대로 배치합니다. 코드는 "어떤 섹션이 존재할 수 있고
 * 각 섹션이 어떤 구조 계약을 갖는가"만 소유하며, "이번 쇼핑몰에 어떤 섹션을 몇 개,
 * 어떤 순서로 둘 것인가"는 page plan(AI)이 정합니다.
 *
 * 안정성 경계: 여기의 어떤 항목도 HeaderV1, verified ProductSectionV1,
 * Cafe24 module/변수 계약을 건드리지 않습니다. featuredProducts는 빈
 * data-cafe24-slot="product-list" wrapper의 "주변"만 설계합니다.
 */

import type { DesignVariant } from "./variants.ts";

/** 섹션이 페이지에서 맡는 역할입니다. plan 정규화 규칙이 이 값을 씁니다. */
export type SectionRole = "products" | "discovery" | "narrative" | "evidence" | "conversion" | "social";

export type SectionTypeId =
  | "categoryGrid"
  | "collection"
  | "featuredProducts"
  | "productFocus"
  | "brandStory"
  | "imageText"
  | "editorialBanner"
  | "lookbook"
  | "materials"
  | "process"
  | "benefits"
  | "specs"
  | "useCases"
  | "gift"
  | "promotion"
  | "socialGallery"
  | "infoGuide"
  | "cta";

/** 같은 섹션도 한 가지 모양만 갖지 않도록 두는 시각 축입니다. */
export const SECTION_ALIGNMENTS = ["left", "center", "right"] as const;
export type SectionAlignment = (typeof SECTION_ALIGNMENTS)[number];

export const SECTION_MEDIA_POSITIONS = ["none", "left", "right", "top", "bottom", "background", "grid"] as const;
export type SectionMediaPosition = (typeof SECTION_MEDIA_POSITIONS)[number];

export const SECTION_DENSITIES = ["airy", "regular", "dense"] as const;
export type SectionDensity = (typeof SECTION_DENSITIES)[number];

export const SECTION_TONES = ["light", "tinted", "dark", "accent"] as const;
export type SectionTone = (typeof SECTION_TONES)[number];

/**
 * 섹션이 화면 폭을 어떻게 쓰는지. 레퍼런스가 한 페이지 안에서 실제로 섞어 쓰는 축이며,
 * 이 값이 없으면 모든 섹션이 같은 폭이 되어 서로 다른 섹션 타입도 같은 모양으로 붕괴합니다.
 */
export const SECTION_CONTAINERS = ["boxed", "wide", "full-bleed", "asymmetric"] as const;
export type SectionContainer = (typeof SECTION_CONTAINERS)[number];

/** 한 행에 놓이는 단위 요소 수입니다. */
export const SECTION_COLUMNS = [1, 2, 3, 4, 5, 6] as const;
export type SectionColumns = (typeof SECTION_COLUMNS)[number];

/** 섹션 표면의 표현입니다. 배경색은 tone이, 카드·괘선 같은 표면 성격은 이 축이 맡습니다. */
export const SECTION_SURFACE_STYLES = ["flat", "card", "outlined", "photoField"] as const;
export type SectionSurfaceStyle = (typeof SECTION_SURFACE_STYLES)[number];

export const SECTION_CONTAINER_SPECS: Record<SectionContainer, string> = {
  boxed: "콘텐츠를 1200px 안쪽으로 모으는 표준 지면. 좌우 여백이 넉넉하다.",
  wide: "1560px까지 넓게 쓰는 지면. 그리드가 많은 진열과 갤러리에 어울린다.",
  "full-bleed": "화면 폭을 끝까지 채운다. 색면 밴드와 대형 이미지가 화면을 가른다.",
  asymmetric: "좌측 여백을 크게 열고 우측을 붙이는 비대칭 지면. 좌측 라벨 컬럼과 우측 콘텐츠 행 구조에 쓴다.",
};

export const SECTION_COLUMN_SPECS: Record<SectionColumns, string> = {
  1: "한 줄에 하나. 장면 하나로 말한다.",
  2: "2열. 비교하거나 짝을 이루는 구성.",
  3: "3열. 근거와 카드의 표준 리듬.",
  4: "4열. 정보 밴드와 타일에 적합.",
  5: "5열. 촘촘한 리테일 밀도.",
  6: "6열 이상의 모자이크. 아이콘 퀵메뉴와 갤러리에 적합.",
};

export const SECTION_SURFACE_STYLE_SPECS: Record<SectionSurfaceStyle, string> = {
  flat: "배경 위에 요소를 그대로 올린다. 카드도 테두리도 없다.",
  card: "단위 요소를 살짝 떠 있는 카드로 감싼다. 리테일 진열의 인상.",
  outlined: "섹션 위아래를 괘선으로 끊는다. 정보와 근거를 정리하는 인상.",
  photoField: "사진이 섹션의 바탕이 된다. 카피는 그 위에 얹힌다(사진 자산이 있을 때만).",
};

export const SECTION_ALIGNMENT_SPECS: Record<SectionAlignment, string> = {
  left: "카피 블록을 좌측 정렬하고 우측에 여백 또는 미디어를 남긴다.",
  center: "카피 블록을 중앙 정렬하고 좌우 대칭 여백으로 무게중심을 가운데 둔다.",
  right: "카피 블록을 우측으로 밀고 좌측을 미디어 또는 여백에 내준다.",
};

export const SECTION_MEDIA_POSITION_SPECS: Record<SectionMediaPosition, string> = {
  none: "사진 없이 타이포·색면·괘선만으로 구성한다. 브랜드 색면을 크게 쓰기 좋은 자리다.",
  left: "미디어를 좌측 컬럼, 카피를 우측 컬럼에 두는 2컬럼.",
  right: "미디어를 우측 컬럼, 카피를 좌측 컬럼에 두는 2컬럼.",
  top: "미디어를 위, 카피를 아래에 두는 세로 스택.",
  bottom: "카피를 위, 미디어를 아래에 두는 세로 스택.",
  background: "미디어를 섹션 배경으로 깔고 카피를 그 위에 올린다(가독을 위한 셰이드 한 겹).",
  grid: "여러 장의 미디어를 그리드 또는 행으로 나열한다.",
};

export const SECTION_DENSITY_SPECS: Record<SectionDensity, string> = {
  airy: "상하 패딩 110~150px, 한 화면에 한 가지 이야기.",
  regular: "상하 패딩 80~110px, 정보와 여백의 표준 균형.",
  dense: "상하 패딩 48~80px, 단위 요소를 촘촘히 붙여 리테일의 활기를 만든다.",
};

export const SECTION_TONE_SPECS: Record<SectionTone, string> = {
  light: "페이지 기본 밝은 배경 위에 잉크 텍스트.",
  tinted: "브랜드 색을 아주 옅게 섞은 배경으로 앞뒤 섹션과 구분되는 밴드.",
  dark: "어두운 배경에 밝은 텍스트. 페이지 리듬을 끊는 무게추.",
  accent: "브랜드 accent를 배경 또는 큰 면적으로 써서 시선을 몰아 주는 전환부.",
};

export type SectionTypeDefinition = {
  id: SectionTypeId;
  role: SectionRole;
  name: string;
  /** AI가 "이 브랜드에 이 섹션이 필요한가"를 판단할 때 읽는 설명입니다. */
  purpose: string;
  /** 사진이 반드시 / 선택적으로 / 전혀 필요 없는지. 이미지 예산 판단에 씁니다. */
  media: "required" | "optional" | "none";
  /** 한 페이지에 두 번 이상 나올 수 있는지. */
  repeatable: boolean;
  /** 이 타입이 의미 있게 반응하는 축. plan 정규화가 나머지 축을 기본값으로 눌러 줍니다. */
  axes: { alignment: boolean; mediaPosition: boolean; density: boolean; tone: boolean };
  /** 이 타입이 쓸 수 있는 컨테이너/컬럼/표면입니다. 비어 있으면 해당 축을 쓰지 않습니다. */
  geometry?: { containers?: SectionContainer[]; columns?: SectionColumns[]; surfaces?: SectionSurfaceStyle[] };
  variants: Record<string, DesignVariant>;
};

function variant(id: string, kind: DesignVariant["kind"], name: string, basedOn: string[], spec: string): DesignVariant {
  return { id, kind, name, basedOn, spec };
}

export const SECTION_TYPES: Record<SectionTypeId, SectionTypeDefinition> = {
  categoryGrid: {
    id: "categoryGrid",
    role: "discovery",
    name: "카테고리 탐색",
    purpose: "상품군이 여러 갈래여서 손님이 먼저 무엇을 파는 곳인지 훑어야 할 때. 종합몰·리테일·유아동·반려동물처럼 SKU가 넓은 브랜드에 필요하고, 단일 라인 브랜드에는 불필요하다.",
    media: "optional",
    repeatable: false,
    axes: { alignment: true, mediaPosition: true, density: true, tone: true },
    geometry: { containers: ["boxed", "wide", "full-bleed"], columns: [3, 4, 5, 6], surfaces: ["flat", "card", "outlined"] },
    variants: {
      "quick-menu": variant("quick-menu", "category", "아이콘 퀵메뉴", ["category/quick-menu"], "원형 또는 라운드 썸네일과 라벨의 카테고리 그리드(PC 6~10개 1행, 모바일 2행 또는 가로 스크롤). 각 항목은 /product/list.html 링크. 레퍼런스 다수가 Hero 바로 아래에 두는 진입 장치이며, 썸네일 바탕을 브랜드 색면으로 깔면 첫 화면에서 색이 바로 읽힌다."),
      "chip-band": variant("chip-band", "category", "텍스트 칩 밴드", ["category/tab-product-rail"], "카테고리명을 큰 텍스트 칩과 밴드로 한 줄에 나열하고 각 칩이 리스트로 링크되는 정적 밴드(JS 탭 금지). 상품 영역 바로 위에 붙여 진열의 도입부로 쓴다."),
      "editorial-index": variant("editorial-index", "category", "에디토리얼 인덱스", ["category/editorial-index"], "괘선으로 구분된 카테고리명 텍스트 리스트(대형 세리프, 각 행에 01/02 번호 라벨). 헤딩 컬럼과 리스트 컬럼의 2컬럼 또는 풀폭 리스트. hover에서 들여쓰기와 색 변화만."),
      "image-tiles": variant("image-tiles", "category", "이미지 타일 그리드", ["category/collection-tiles"], "카테고리마다 한 장의 이미지 타일(비율 4/5 또는 1/1)과 라벨을 얹는 3~6칸 그리드. 타일 간 여백과 캡션 타이포로 브랜드 톤을 만든다."),
    },
  },
  collection: {
    id: "collection",
    role: "discovery",
    name: "컬렉션/라인업 소개",
    purpose: "상품이 시즌·라인·용도로 묶여 있고 그 묶음 자체가 구매 결정의 축일 때. 컬렉션 개념이 없는 단품 브랜드에는 쓰지 않는다.",
    media: "required",
    repeatable: true,
    axes: { alignment: true, mediaPosition: true, density: true, tone: true },
    geometry: { containers: ["boxed", "wide", "full-bleed", "asymmetric"], columns: [2, 3, 4], surfaces: ["flat", "card", "photoField"] },
    variants: {
      "tile-cards": variant("tile-cards", "category", "컬렉션 타일 카드", ["category/collection-tiles"], "이미지 타일 2~3장(비율 4/5 또는 1/1)에 컬렉션명과 more 링크를 오버레이 또는 하단 캡션으로 얹는 카드 행."),
      "split-feature": variant("split-feature", "category", "대표 컬렉션 스플릿", ["category/collection-tiles", "story/split-media"], "대표 컬렉션 한 줄을 반폭 이미지와 반폭 카피로 크게 세우고, 나머지 컬렉션은 아래 작은 칩 또는 링크 목록으로 받친다."),
      "index-list": variant("index-list", "category", "라인업 인덱스", ["category/editorial-index"], "라인업 이름을 번호와 함께 큰 텍스트로 세로 나열하고, 각 행 우측에 한 줄 설명과 링크를 둔다. 이미지는 없거나 아주 작은 썸네일만."),
    },
  },
  featuredProducts: {
    id: "featuredProducts",
    role: "products",
    name: "상품 진열(검증 슬롯)",
    purpose: "실제 Cafe24 상품이 들어가는 단 하나의 자리. 모든 페이지에 정확히 하나 있어야 하며, 위치는 브랜드의 구매 여정에 따라 정한다.",
    media: "none",
    repeatable: false,
    axes: { alignment: true, mediaPosition: false, density: true, tone: true },
    geometry: { containers: ["boxed", "wide", "full-bleed"] },
    variants: {
      "heading-more": variant("heading-more", "product-context", "타이틀+more 프레임", ["product-context/heading-more"], "상품 슬롯 위에 영문 라벨과 국문 타이틀 페어, 아래 또는 우측에 more 링크. 레퍼런스에서 가장 보편적인 진열 프레임이며, 헤딩은 작게 중앙에 두는 경우가 많다."),
      "best-frame": variant("best-frame", "product-context", "베스트 프레임", ["product-context/best-ranking"], "BEST 또는 TOP SELLER 성격의 헤딩과 절제된 부카피로 상품 슬롯을 감싼다. 판매 수치와 순위 숫자를 지어내지 않고 헤딩의 무게만 가져온다."),
      "curation-band": variant("curation-band", "product-context", "큐레이션 밴드", ["product-context/curation-band"], "MD 추천 또는 시즌 에디트 성격의 2~3문장 큐레이션 카피 블록이 상품 슬롯을 이끈다. 배경 톤을 페이지와 살짝 달리해 밴드로 인지되게 한다."),
      "quiet-grid": variant("quiet-grid", "product-context", "무헤딩 정숙 진열", ["product-context/heading-more", "story/lookbook-row"], "장식적인 헤딩 없이 아주 작은 라벨 하나와 넓은 여백만으로 상품 슬롯을 연다. 앞 섹션이 이미 말을 많이 했을 때 쓴다."),
    },
  },
  productFocus: {
    id: "productFocus",
    role: "narrative",
    name: "대표 상품 집중",
    purpose: "간판 상품 한둘이 브랜드를 대표하고 그 하나를 크게 설명해야 살 결심이 서는 경우. 상품 수가 많고 균질한 몰에는 부적합하다. 실제 상품 카드가 아니라 대표 상품의 이야기와 디테일 컷을 다룬다.",
    media: "required",
    repeatable: true,
    axes: { alignment: true, mediaPosition: true, density: true, tone: true },
    geometry: { containers: ["boxed", "wide", "full-bleed", "asymmetric"], columns: [1, 2, 3], surfaces: ["flat", "card", "photoField"] },
    variants: {
      "hero-detail": variant("hero-detail", "story", "대표 상품 클로즈업", ["story/split-media", "product-context/curation-band"], "대표 상품의 대형 클로즈업 한 컷과 그 옆의 이름, 핵심 한 줄, 짧은 설명 3문장, 상세 링크. 가격과 재고는 쓰지 않는다."),
      "detail-strip": variant("detail-strip", "story", "디테일 3컷 스트립", ["story/lookbook-row", "product-context/heading-more"], "같은 상품의 서로 다른 디테일 3컷을 가로로 나열하고 각 컷 아래 한 줄 캡션. 소재, 마감, 사용 장면을 나눠 보여 준다."),
      "spec-overlay": variant("spec-overlay", "story", "스펙 오버레이 컷", ["story/dark-statement", "product-context/best-ranking"], "상품 한 컷을 넓게 깔고 그 위나 옆에 2~4개의 짧은 스펙 라인을 괘선과 함께 얹는다. 검증 불가한 수치는 쓰지 않는다."),
    },
  },
  brandStory: {
    id: "brandStory",
    role: "narrative",
    name: "브랜드 서사",
    purpose: "브랜드의 철학, 시작, 태도가 구매 이유의 일부일 때. 가격과 편의가 구매 이유인 리테일에서는 짧게 줄이거나 생략한다.",
    media: "optional",
    repeatable: false,
    axes: { alignment: true, mediaPosition: true, density: true, tone: true },
    geometry: { containers: ["boxed", "wide", "full-bleed", "asymmetric"], surfaces: ["flat", "photoField"] },
    variants: {
      "split-media": variant("split-media", "story", "스플릿 미디어 스토리", ["story/split-media"], "사진 50~54%와 카피 46~50%의 2컬럼 브랜드 서사(min-height 60~76svh). 카피는 eyebrow, 대형 타이틀, 본문 2~4문장, 텍스트 링크. 모바일은 이미지에서 카피 순서의 스택."),
      "dark-statement": variant("dark-statement", "story", "다크 선언 밴드", ["story/dark-statement"], "어두운 배경 전폭 밴드(min-height 42~60svh)에 큰 카피 1~2줄과 짧은 보조문. 배경은 단색 또는 저채도 이미지와 셰이드."),
      "quiet-manifesto": variant("quiet-manifesto", "story", "정숙한 선언문", ["cta/statement-text", "story/dark-statement"], "이미지 없이 넉넉한 상하 패딩과 좁은 본문 폭(최대 560px)의 문장 블록. 문단 사이 여백을 크게 두어 읽는 속도를 늦춘다. airy 밀도에서만 쓴다."),
      timeline: variant("timeline", "story", "연혁/여정 타임라인", ["story/split-media", "product-context/heading-more"], "연도 또는 단계 라벨과 한 줄 설명이 괘선을 따라 이어지는 3~5행 타임라인. 검증 불가한 수상과 인증은 넣지 않는다."),
    },
  },
  imageText: {
    id: "imageText",
    role: "narrative",
    name: "이미지+텍스트 블록",
    purpose: "한 가지 주장을 사진 한 장과 짧은 글로 설명해야 할 때 쓰는 범용 블록. 브랜드 서사와 달리 주제가 자유롭다(사용 장면, 배송, 시즌 제안 등).",
    media: "required",
    repeatable: true,
    axes: { alignment: true, mediaPosition: true, density: true, tone: true },
    geometry: { containers: ["boxed", "wide", "full-bleed", "asymmetric"], surfaces: ["flat", "photoField"] },
    variants: {
      "side-by-side": variant("side-by-side", "story", "좌우 분할 블록", ["story/split-media"], "이미지와 카피를 좌우로 나누는 표준 2컬럼. mediaPosition 축이 좌우를 결정하며, 같은 페이지에서 두 번 쓰면 좌우를 반드시 뒤집는다."),
      "offset-overlap": variant("offset-overlap", "story", "오프셋 겹침 블록", ["story/lookbook-row", "story/split-media"], "이미지를 섹션 폭 밖으로 살짝 흘리고 카피 카드를 그 위에 겹쳐 얹는다. 겹침은 한 방향으로만, 모바일에서는 겹침을 풀어 세로 스택."),
      "wide-caption": variant("wide-caption", "story", "와이드 컷+캡션", ["story/lookbook-row"], "가로로 넓은 이미지 한 장(비율 16/9~21/9) 아래 짧은 캡션과 링크. 장면 하나로 설명한다."),
    },
  },
  editorialBanner: {
    id: "editorialBanner",
    role: "conversion",
    name: "에디토리얼 배너",
    purpose: "시즌 캠페인, 기획전, 신상 소식처럼 지금 이것을 보라는 전환부가 필요할 때.",
    media: "required",
    repeatable: true,
    axes: { alignment: true, mediaPosition: true, density: false, tone: true },
    geometry: { containers: ["full-bleed", "wide", "boxed"], surfaces: ["flat", "photoField"] },
    variants: {
      "full-campaign": variant("full-campaign", "cta", "풀폭 캠페인", ["cta/full-campaign"], "전폭 이미지(min-height 56~78svh) 위 방향성 셰이드와 카피, 밑줄형 CTA 링크 1개."),
      "half-split": variant("half-split", "cta", "반폭 스플릿 배너", ["cta/promo-duo"], "이미지 반폭과 색면 반폭의 배너. 색면 쪽에 라벨, 카피, 링크를 두어 시선을 한쪽으로 몬다."),
      "marquee-strip": variant("marquee-strip", "cta", "마퀴 스트립", ["cta/marquee-strip"], "시즌 키워드를 가운뎃점으로 이어 반복한 한 줄 대형 텍스트 스트립(정적, keyframes 금지). 섹션 사이 전환부에 한 번만."),
    },
  },
  lookbook: {
    id: "lookbook",
    role: "narrative",
    name: "룩북/에디토리얼 이미지 행",
    purpose: "설명보다 장면이 설득력을 갖는 브랜드(패션, 인테리어, 오브제). 사진 자산이 충분할 때만 쓴다.",
    media: "required",
    repeatable: false,
    axes: { alignment: false, mediaPosition: true, density: true, tone: true },
    geometry: { containers: ["full-bleed", "wide", "asymmetric"], columns: [2, 3, 4, 6], surfaces: ["flat", "photoField"] },
    variants: {
      "offset-row": variant("offset-row", "story", "오프셋 이미지 행", ["story/lookbook-row"], "이미지 3~4장을 서로 다른 높이 오프셋으로 나란히 흘리는 행. 텍스트는 섹션 라벨 하나까지만."),
      "editorial-grid": variant("editorial-grid", "story", "에디토리얼 그리드", ["story/lookbook-row", "category/collection-tiles"], "크기가 다른 이미지 4~6장을 비대칭 그리드로 짜 맞춘다. 큰 컷 1장이 시선의 기준점이 되게 한다."),
      "full-scroll-pair": variant("full-scroll-pair", "story", "전폭 2연컷", ["story/lookbook-row", "cta/full-campaign"], "전폭 이미지 2장을 여백 없이 위아래로 붙여 장면 전환처럼 보이게 한다. 캡션은 아주 작게 한 줄."),
    },
  },
  materials: {
    id: "materials",
    role: "evidence",
    name: "소재/원료 설명",
    purpose: "무엇으로 만들었는지가 구매 근거인 업종(식품, 화장품, 의류 소재, 가구 원목). 재료가 구매와 무관한 업종에는 쓰지 않는다.",
    media: "optional",
    repeatable: false,
    axes: { alignment: true, mediaPosition: true, density: true, tone: true },
    geometry: { containers: ["boxed", "wide", "asymmetric"], columns: [2, 3, 4, 5], surfaces: ["flat", "card", "outlined"] },
    variants: {
      "ingredient-cards": variant("ingredient-cards", "trust", "원료 카드 행", ["product-context/curation-band", "category/collection-tiles"], "원료 또는 소재 3~5개를 각각 이미지(또는 색면)와 이름, 한 줄 설명 카드로 나열한다. 효능 주장과 인증 문구는 쓰지 않는다."),
      "annotated-photo": variant("annotated-photo", "trust", "주석 달린 원물 컷", ["story/split-media"], "원료와 소재의 클로즈업 한 컷 옆에 2~4개의 짧은 항목을 괘선 리스트로 붙인다."),
      "text-columns": variant("text-columns", "trust", "소재 텍스트 컬럼", ["product-context/curation-band"], "사진 없이 2~3 컬럼의 짧은 텍스트 블록으로 소재와 그 선택 이유를 적는다. 타이포와 색면 위주."),
    },
  },
  process: {
    id: "process",
    role: "evidence",
    name: "제조/공정/주문 흐름",
    purpose: "만드는 과정이나 주문과 제작 흐름이 신뢰의 근거일 때(수제, 주문제작, 시공, 정기배송). 기성품 유통몰에는 불필요하다.",
    media: "optional",
    repeatable: false,
    axes: { alignment: true, mediaPosition: true, density: true, tone: true },
    geometry: { containers: ["boxed", "wide", "asymmetric"], columns: [1, 3, 4, 5], surfaces: ["flat", "outlined", "card"] },
    variants: {
      "numbered-steps": variant("numbered-steps", "trust", "번호 스텝 행", ["product-context/heading-more", "story/split-media"], "01~04 번호와 제목, 한 줄 설명이 가로로 이어지는 스텝 행. 각 스텝에 작은 이미지 또는 색면 하나까지 허용."),
      "process-strip": variant("process-strip", "trust", "공정 이미지 스트립", ["story/lookbook-row"], "공정 장면 3~4컷을 가로 스트립으로 붙이고 각 컷 아래 한 단어 라벨. 사진이 설명을 대신한다."),
      "vertical-flow": variant("vertical-flow", "trust", "세로 흐름 리스트", ["category/editorial-index"], "괘선으로 나뉜 세로 리스트에 단계명과 설명을 좌우로 배치. 단계가 5개 이상일 때 적합."),
    },
  },
  benefits: {
    id: "benefits",
    role: "evidence",
    name: "혜택/약속",
    purpose: "배송, 교환, A/S, 멤버십처럼 사실로 확인되는 약속을 정리해 구매 장벽을 낮출 때.",
    media: "none",
    repeatable: false,
    axes: { alignment: true, mediaPosition: false, density: true, tone: true },
    geometry: { containers: ["boxed", "wide", "full-bleed"], columns: [3, 4], surfaces: ["outlined", "flat", "card"] },
    variants: {
      "icon-columns": variant("icon-columns", "trust", "3~4 컬럼 정보 밴드", ["product-context/heading-more"], "3~4개의 짧은 항목을 괘선 그리드로 나열하는 정보 밴드. 아이콘 대신 라벨 타이포로 구분한다. 검증 불가한 수상, 인증, 판매수치 금지."),
      "inline-band": variant("inline-band", "trust", "한 줄 인라인 밴드", ["cta/marquee-strip", "product-context/heading-more"], "높이가 낮은 한 줄 밴드에 3~4개 약속을 가운뎃점으로 구분해 배치. 섹션 사이의 얇은 구분선 역할."),
      "list-panel": variant("list-panel", "trust", "리스트 패널", ["product-context/curation-band"], "한쪽에 헤딩, 다른 쪽에 항목 리스트를 두는 2컬럼 패널. 항목마다 제목과 한 줄 설명."),
    },
  },
  specs: {
    id: "specs",
    role: "evidence",
    name: "스펙/사양표",
    purpose: "치수, 호환, 용량, 성분처럼 숫자와 표가 구매 판단을 좌우하는 업종(자동차용품, 가전, 가구, 공구). 감성 브랜드에는 부적합하다.",
    media: "none",
    repeatable: false,
    axes: { alignment: true, mediaPosition: false, density: true, tone: true },
    geometry: { containers: ["boxed", "wide"], columns: [1, 2, 3, 4], surfaces: ["outlined", "flat"] },
    variants: {
      "spec-table": variant("spec-table", "trust", "괘선 사양표", ["product-context/heading-more"], "항목과 값 두 열의 괘선 표 3~6행. 실제로 확인 가능한 일반 사양만 적고 성능 수치는 지어내지 않는다."),
      "compare-columns": variant("compare-columns", "trust", "비교 컬럼", ["product-context/best-ranking"], "2~3개 라인을 나란히 두고 항목별 차이를 짧게 적는 비교 컬럼. 경쟁사 비교는 하지 않는다."),
      "dark-spec-band": variant("dark-spec-band", "trust", "다크 스펙 밴드", ["story/dark-statement", "product-context/heading-more"], "어두운 배경 위에 4개 이하의 큰 숫자와 라벨 페어를 균등 배치. 기술적 인상을 만드는 전환부."),
    },
  },
  useCases: {
    id: "useCases",
    role: "narrative",
    name: "사용 장면/추천 상황",
    purpose: "언제 어떻게 쓰는지가 구매를 만드는 상품(생활용품, 캠핑, 반려, 유아). 용도가 자명한 상품에는 불필요하다.",
    media: "optional",
    repeatable: false,
    axes: { alignment: true, mediaPosition: true, density: true, tone: true },
    geometry: { containers: ["boxed", "wide", "full-bleed"], columns: [3, 4, 5], surfaces: ["flat", "card", "photoField"] },
    variants: {
      "scene-cards": variant("scene-cards", "story", "장면 카드 그리드", ["category/collection-tiles", "story/lookbook-row"], "사용 장면 3~4개를 이미지와 상황 라벨, 한 줄 설명 카드로 나열한다."),
      "question-list": variant("question-list", "story", "상황 질문 리스트", ["category/editorial-index"], "이럴 때 쓰라는 성격의 상황 문장을 번호와 함께 세로로 나열하고 각 행에 카테고리 링크를 붙인다. 이미지 없이도 성립."),
      "day-in-life": variant("day-in-life", "story", "하루 흐름 스트립", ["story/lookbook-row", "product-context/heading-more"], "아침에서 저녁 같은 시간 흐름으로 장면 3~5컷을 가로 배열하고 각 컷에 시간 라벨을 단다."),
    },
  },
  gift: {
    id: "gift",
    role: "conversion",
    name: "선물/패키지 제안",
    purpose: "선물 수요가 실제로 큰 업종(식품, 디저트, 뷰티, 리빙 소품, 유아 출산선물). 선물 수요가 없는 상품군에는 쓰지 않는다.",
    media: "required",
    repeatable: false,
    axes: { alignment: true, mediaPosition: true, density: true, tone: true },
    geometry: { containers: ["boxed", "wide", "full-bleed"], columns: [2, 3], surfaces: ["flat", "card", "photoField"] },
    variants: {
      "gift-duo": variant("gift-duo", "cta", "선물 듀오 패널", ["cta/promo-duo"], "반폭 패널 2장에 서로 다른 선물 제안(구성, 가격대, 받는 사람)을 병렬로 놓고 각각 링크를 단다. 실제 구성품을 지어내지 않는다."),
      "package-feature": variant("package-feature", "cta", "패키지 피처", ["cta/full-campaign", "story/split-media"], "패키지와 포장 컷을 크게 세우고 옆에 선물 상황 카피와 CTA 하나. 제공 여부가 불확실한 요소는 언급하지 않는다."),
      "occasion-chips": variant("occasion-chips", "cta", "상황별 칩", ["category/quick-menu", "cta/promo-duo"], "명절, 생일, 집들이 같은 상황 라벨을 칩으로 나열하고 각 칩이 리스트로 링크되는 낮은 밴드."),
    },
  },
  promotion: {
    id: "promotion",
    role: "conversion",
    name: "기획전/프로모션",
    purpose: "기획전, 이벤트, 세트 구성처럼 병렬 제안이 필요한 경우. 할인율과 기간 같은 실제 값은 지어내지 않고 자리만 만든다.",
    media: "required",
    repeatable: false,
    axes: { alignment: true, mediaPosition: true, density: true, tone: true },
    geometry: { containers: ["boxed", "wide", "full-bleed"], columns: [2, 3], surfaces: ["flat", "card", "photoField"] },
    variants: {
      "project-board": variant("project-board", "cta", "기획전 보드", ["promotion/project-board"], "기획전 이미지 2~3장을 같은 크기 타일로 나열하고 각 타일에 제목 라벨과 링크를 단다. Cafe24 기획전(Layout_project) 자리를 대신하는 정적 보드."),
      "promo-duo": variant("promo-duo", "cta", "프로모션 듀오 패널", ["cta/promo-duo"], "반폭 패널 2장(또는 1/3 패널 3장)의 grid. 각 패널은 이미지, 라벨, 짧은 카피, 링크로 서로 다른 기획을 병렬 제안."),
      "single-notice": variant("single-notice", "cta", "단일 공지 밴드", ["cta/statement-text"], "이미지 없이 한 줄 공지 카피와 링크만 두는 낮은 밴드. 값을 지어내지 않고 형식만 제공한다."),
    },
  },
  socialGallery: {
    id: "socialGallery",
    role: "social",
    name: "SNS/고객 장면 갤러리",
    purpose: "브랜드가 소셜에서 소비되는 업종(패션, 뷰티, 반려, 인테리어). 리뷰 본문, 별점, 팔로워 수는 실제 데이터가 없으므로 절대 지어내지 않고 장면 이미지로만 신뢰의 인상을 만든다.",
    media: "required",
    repeatable: false,
    axes: { alignment: true, mediaPosition: true, density: true, tone: true },
    geometry: { containers: ["full-bleed", "wide", "boxed"], columns: [3, 4, 5, 6], surfaces: ["flat", "photoField"] },
    variants: {
      "sns-grid": variant("sns-grid", "social", "SNS 갤러리", ["social/sns-gallery"], "정방형 이미지 4~6장의 그리드와 핸들 라벨. 팔로워 수와 좋아요 수 등 수치는 만들지 않는다."),
      "ugc-strip": variant("ugc-strip", "social", "UGC 스트립", ["social/review-band"], "고객 씬 무드의 라이프스타일 컷 3~4장과 REAL MOMENTS 성격의 라벨. 별점과 후기 텍스트 금지."),
      "wide-mosaic": variant("wide-mosaic", "social", "와이드 모자이크", ["social/sns-gallery", "story/lookbook-row"], "화면 폭을 가득 채우는 6~8칸 모자이크. 셀 크기를 두 종류로 섞어 리듬을 만든다."),
    },
  },
  infoGuide: {
    id: "infoGuide",
    role: "evidence",
    name: "이용 안내/관리법",
    purpose: "구매 전 알아야 할 사용법, 보관법, 시공과 설치 안내가 실제로 필요한 상품. 안내가 필요 없는 단순 상품에는 넣지 않는다.",
    media: "none",
    repeatable: false,
    axes: { alignment: true, mediaPosition: false, density: true, tone: true },
    geometry: { containers: ["boxed", "wide", "asymmetric"], columns: [2, 3, 4], surfaces: ["outlined", "flat"] },
    variants: {
      "info-columns": variant("info-columns", "trust", "인포 컬럼", ["product-context/curation-band"], "제품 철학, 사용 안내, 관리법 같은 도움말 성격의 2~3 컬럼 텍스트 블록. 아이콘 없이 텍스트와 괘선 위주."),
      "qa-list": variant("qa-list", "trust", "문답 리스트", ["category/editorial-index"], "질문 한 줄과 답 두 줄이 괘선으로 나뉘어 이어지는 3~5행 리스트. 배송과 교환 규정 같은 확정 값은 적지 않고 일반적 안내만."),
      "care-band": variant("care-band", "trust", "관리 안내 밴드", ["product-context/heading-more"], "낮은 밴드에 관리와 보관 항목 3~4개를 균등 배치. 페이지 하단 마감 직전의 실용 정보 자리."),
    },
  },
  cta: {
    id: "cta",
    role: "conversion",
    name: "마감 CTA",
    purpose: "페이지를 다음 행동으로 닫는 자리. 대부분의 몰에 필요하지만, 이미 배너나 프로모션으로 전환부를 충분히 만들었다면 생략할 수 있다.",
    media: "optional",
    repeatable: false,
    axes: { alignment: true, mediaPosition: true, density: true, tone: true },
    geometry: { containers: ["full-bleed", "boxed", "wide"], columns: [1], surfaces: ["flat", "photoField"] },
    variants: {
      "statement-text": variant("statement-text", "cta", "텍스트 선언 CTA", ["cta/statement-text"], "이미지 없이 넉넉한 상하 패딩(120px 이상)과 대형 타이포 2~3줄, 아래 텍스트 링크 1개. 배경은 페이지와 한 톤 다른 단색."),
      "full-campaign": variant("full-campaign", "cta", "풀폭 캠페인 CTA", ["cta/full-campaign"], "전폭 이미지 위 방향성 셰이드와 카피, 밑줄형 CTA 링크 1개. 시즌 캠페인으로 이어지는 문."),
      "compact-bar": variant("compact-bar", "cta", "컴팩트 CTA 바", ["cta/marquee-strip", "cta/statement-text"], "높이 낮은 바에 한 줄 카피와 링크 버튼 하나. 아래 Cafe24 푸터로 조용히 넘긴다."),
    },
  },
};

export const SECTION_TYPE_IDS = Object.keys(SECTION_TYPES) as SectionTypeId[];

export function sectionType(id: string): SectionTypeDefinition | undefined {
  return SECTION_TYPES[id as SectionTypeId];
}

export function isSectionTypeId(value: unknown): value is SectionTypeId {
  return typeof value === "string" && value in SECTION_TYPES;
}

/** "type/variant" ref로 섹션 variant를 찾습니다. */
export function sectionVariant(ref: string): DesignVariant {
  const [typeId, variantId] = ref.split("/");
  const definition = sectionType(typeId ?? "");
  const found = definition?.variants[variantId ?? ""];
  if (!found) throw new Error(`알 수 없는 section variant입니다: ${ref}`);
  return found;
}

/** 모든 섹션 variant를 "type/variant" 키로 펼친 사전입니다. */
export const SECTION_VARIANTS: Record<string, DesignVariant> = Object.fromEntries(
  SECTION_TYPE_IDS.flatMap((typeId) =>
    Object.keys(SECTION_TYPES[typeId].variants).map((variantId) => [`${typeId}/${variantId}`, SECTION_TYPES[typeId].variants[variantId]] as const),
  ),
);

/** page plan 생성 AI에게 넘기는 레지스트리 카탈로그 텍스트입니다. */
export function renderSectionCatalog() {
  return SECTION_TYPE_IDS.map((typeId) => {
    const definition = SECTION_TYPES[typeId];
    const variantList = Object.values(definition.variants).map((item) => `${item.id}(${item.name})`).join(" | ");
    const repeat = definition.repeatable ? "여러 번 가능" : "한 번만";
    return `- ${definition.id} [role=${definition.role}, media=${definition.media}, ${repeat}] ${definition.name}\n  쓰는 경우: ${definition.purpose}\n  variant: ${variantList}`;
  }).join("\n");
}

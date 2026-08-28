/**
 * MOLIVE 디자인 축(axis) 라이브러리입니다.
 * reference-patterns.ts의 실제 Cafe24 레퍼런스 패턴을 AI가 그대로 시공할 수 있는
 * 구조 계약(spec)으로 옮긴 것으로, 페이지 전역에 한 번씩만 정해지는 축을 담습니다.
 * (Hero variant / Header 구조 / 상품 진열 / Footer 무드 / 밀도 / 타이포 / 이미지 처리)
 *
 * 본문 섹션의 종류·variant는 section-registry.ts가 소유하고, 이번 페이지에 어떤 섹션을
 * 어떤 순서로 둘지는 page-plan.ts의 Page Plan(AI 결정)이 소유합니다.
 *
 * 안정성 경계: 여기의 variant는 전부 AI 소유 캔버스만 다룹니다.
 * HeaderV1, verified ProductSectionV1, Cafe24 module/변수 계약은 건드리지 않습니다.
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

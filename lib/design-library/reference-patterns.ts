/**
 * Cafe24 레퍼런스 구조 분석 결과입니다.
 * Guide/Cafe24-Design-References/Cafe24-Design-References.txt의 데모몰 37곳과
 * Guide 기본 스킨 3종(skin4/skin17/skin18)의 index 구조에서 추출한 패턴 사전이며,
 * variants.ts의 variant 정의가 어떤 실제 사례에 근거하는지 추적하는 용도입니다.
 */

export type ReferencePatternKind = "hero" | "category" | "product-context" | "story" | "social" | "cta" | "promotion" | "footer";

export type ReferencePattern = {
  id: string;
  kind: ReferencePatternKind;
  name: string;
  /** 패턴이 관찰된 레퍼런스: PTMD 코드 또는 기본 스킨 이름 */
  observedIn: string[];
  traits: string;
};

export const REFERENCE_PATTERNS: ReferencePattern[] = [
  // Hero
  {
    id: "hero/keyvisual-slider",
    kind: "hero",
    name: "풀블리드 키비주얼",
    observedIn: ["PTMD825692", "PTMD869920", "PTMD708527", "PTMD397676", "skin4:mainVisual"],
    traits: "화면 폭 전체를 채우는 대형 비주얼 위에 카피를 얹는 가장 보편적인 도입부. 슬라이더로 운용되는 경우가 많지만 정적 1컷으로도 같은 인상을 만든다.",
  },
  {
    id: "hero/fullscreen-cinematic",
    kind: "hero",
    name: "시네마틱 풀스크린",
    observedIn: ["PTMD875629", "PTMD811384", "PTMD875640", "PTMD857660"],
    traits: "100vh에 가까운 어두운 영상/스틸 위에 절제된 카피. fullpage 스크롤·비디오 섹션과 함께 쓰이며 식품·뷰티 프리미엄 몰에서 관찰된다.",
  },
  {
    id: "hero/split-editorial",
    kind: "hero",
    name: "스플릿 에디토리얼",
    observedIn: ["PTMD876041", "PTMD856024", "PTMD838115"],
    traits: "카피 컬럼과 사진 컬럼을 나누는 비대칭 도입부. 패션 몰에서 지면 잡지의 인상을 만든다.",
  },
  {
    id: "hero/banner-stack",
    kind: "hero",
    name: "갤러리+타일 배너 스택",
    observedIn: ["skin17:main_image_text_gallery", "skin18:main_image_text_gallery", "PTMD867234", "PTMD869025"],
    traits: "대형 이미지 갤러리 아래 3단 타일 배너(main_3dan_banner)가 붙는 구성. 도입부가 하나의 컷이 아니라 편집된 보드처럼 보인다.",
  },
  {
    id: "hero/product-forward",
    kind: "hero",
    name: "상품 우선 컴팩트 배너",
    observedIn: ["PTMD873917", "PTMD876822", "PTMD874793"],
    traits: "낮은 배너와 퀵메뉴 뒤에 곧바로 상품 그리드가 오는 리테일형 도입부. 종합몰·반려동물·생활 카테고리에서 관찰된다.",
  },
  {
    id: "hero/typographic-statement",
    kind: "hero",
    name: "타이포그래픽 선언",
    observedIn: ["PTMD856024", "PTMD846911"],
    traits: "초대형 워드마크/카피(BOLD 등)와 marquee 흐름 텍스트가 비주얼을 대신하는 브랜드 우선 도입부.",
  },

  // Category / Collection
  {
    id: "category/quick-menu",
    kind: "category",
    name: "아이콘 퀵메뉴",
    observedIn: ["PTMD876822", "PTMD873917", "PTMD688485"],
    traits: "\"무엇을 찾으시나요?\" 류의 카테고리 아이콘/썸네일 그리드. 유아동·반려동물·종합몰의 탐색 관문.",
  },
  {
    id: "category/tab-product-rail",
    kind: "category",
    name: "카테고리 탭 상품 레일",
    observedIn: ["skin17:main_product_category", "PTMD876619:main_tab_prd", "skin4:saleItem.tab"],
    traits: "탭으로 카테고리를 전환하며 상품 진열(product_listmain_N)을 바꾸는 구성.",
  },
  {
    id: "category/editorial-index",
    kind: "category",
    name: "에디토리얼 인덱스 리스트",
    observedIn: ["PTMD876041", "PTMD739431"],
    traits: "번호·괘선과 함께 카테고리명을 큰 세리프 텍스트 목록으로 나열. 패션 몰의 목차형 내비게이션.",
  },
  {
    id: "category/collection-tiles",
    kind: "category",
    name: "컬렉션 타일 카드",
    observedIn: ["skin4:collection-item", "PTMD867234:main-half-banner", "PTMD869025"],
    traits: "이미지 타일 2~3장에 컬렉션명과 more 링크를 얹는 카드형 진입.",
  },

  // Product 주변
  {
    id: "product-context/heading-more",
    kind: "product-context",
    name: "타이틀+more 진열 프레임",
    observedIn: ["skin17", "skin18", "PTMD762233", "대부분의 레퍼런스"],
    traits: "main_title_txt01/txt02(영문 라벨+국문 타이틀)와 more 버튼이 상품 그리드를 감싸는 보편 프레임.",
  },
  {
    id: "product-context/best-ranking",
    kind: "product-context",
    name: "베스트/랭킹 강조",
    observedIn: ["PTMD867234:베스트 제품·실시간 판매", "PTMD837610:Top Seller", "PTMD869025:BEST ITEM"],
    traits: "판매 신뢰를 만드는 BEST·랭킹 헤딩. 실데이터 없이 순위 숫자를 지어내면 안 되므로 헤딩·프레임만 차용한다.",
  },
  {
    id: "product-context/curation-band",
    kind: "product-context",
    name: "MD 큐레이션 밴드",
    observedIn: ["PTMD869025:MD's PICK", "PTMD874793"],
    traits: "짧은 큐레이션 카피와 함께 상품 진열을 편집숍 추천처럼 감싸는 밴드.",
  },

  // Story / Editorial
  {
    id: "story/split-media",
    kind: "story",
    name: "스플릿 미디어 브랜드 스토리",
    observedIn: ["PTMD867234:OUR PHILOSOPHY", "PTMD869025:Brand Commentary"],
    traits: "사진 절반 + 카피 절반의 브랜드 서사. 소재·공정·철학을 말하는 자리.",
  },
  {
    id: "story/dark-statement",
    kind: "story",
    name: "다크 풀폭 선언 밴드",
    observedIn: ["PTMD869025:LESS NOISE, MORE FLAVOR", "PTMD811384:main_brand", "PTMD875629:main_brand"],
    traits: "어두운 배경 전폭 밴드에 큰 카피 한 줄. 페이지 리듬을 끊어 주는 무게추.",
  },
  {
    id: "story/lookbook-row",
    kind: "story",
    name: "룩북/에디토리얼 이미지 행",
    observedIn: ["PTMD856024:main-images", "PTMD851474:main-thumb", "skin18:image-gallery/2"],
    traits: "설명 없이 이미지 3~5장을 나란히 흘리는 룩북 행. 패션·오브제 몰의 톤을 만든다.",
  },

  // Social proof
  {
    id: "social/sns-gallery",
    kind: "social",
    name: "SNS/인스타그램 갤러리",
    observedIn: ["skin4:snsItem", "PTMD867234:main-instagram-benner", "PTMD857660"],
    traits: "정방형 이미지 그리드와 핸들(@brand)로 채우는 소셜 갤러리. 가짜 팔로워 수치는 쓰지 않는다.",
  },
  {
    id: "social/review-band",
    kind: "social",
    name: "리뷰 밴드",
    observedIn: ["PTMD855689", "PTMD867234:REVIEW", "PTMD869025:REVIEW"],
    traits: "리뷰 카드가 흐르는 밴드. 실제 데이터가 없으므로 우리 시스템에서는 리뷰 본문을 지어내는 대신 UGC 이미지 갤러리로 대체한다.",
  },

  // CTA / Banner
  {
    id: "cta/full-campaign",
    kind: "cta",
    name: "풀폭 캠페인 배너",
    observedIn: ["skin4:middleBanner", "PTMD867234:main-full-banner", "PTMD869025:EVENT"],
    traits: "전폭 이미지 + 카피 + 단일 CTA. 시즌 캠페인/기획전으로 이어지는 문.",
  },
  {
    id: "cta/statement-text",
    kind: "cta",
    name: "텍스트 선언 CTA",
    observedIn: ["skin18:main_text", "PTMD875640"],
    traits: "이미지 없이 타이포만으로 만드는 조용한 CTA 섹션(ez-textsize 계열).",
  },
  {
    id: "cta/promo-duo",
    kind: "cta",
    name: "프로모션 듀오 패널",
    observedIn: ["PTMD869025:main-half-text-banner", "skin17:main_3dan_banner"],
    traits: "2~3개의 반폭 패널로 기획전·선물세트·이벤트를 병렬 제안.",
  },
  {
    id: "cta/marquee-strip",
    kind: "cta",
    name: "마퀴 티커 스트립",
    observedIn: ["PTMD846911"],
    traits: "흐르는 텍스트 스트립으로 시즌 키워드를 반복 노출. 장식이므로 한 페이지 한 번만.",
  },

  // 기획전 / 프로모션
  {
    id: "promotion/project-board",
    kind: "promotion",
    name: "기획전 타일 보드",
    observedIn: ["skin4:Layout_project"],
    traits: "기본 스킨 skin4의 Layout_project 모듈. \"기획전\" 헤딩 아래 같은 크기의 카테고리 이미지 타일을 목록으로 나열해 기획 단위 진입을 만든다. 우리 시스템에서는 module을 쓰지 않고 같은 인상의 정적 타일 보드로 대체한다.",
  },

  // Footer mood
  {
    id: "footer/paper-light",
    kind: "footer",
    name: "라이트 페이퍼 푸터",
    observedIn: ["skin4", "PTMD874793"],
    traits: "밝은 회백 배경의 표준 인포 푸터.",
  },
  {
    id: "footer/ink-dark",
    kind: "footer",
    name: "잉크 다크 푸터",
    observedIn: ["PTMD869025", "PTMD867234", "PTMD857660"],
    traits: "어두운 잉크 배경에 밝은 글자. 에디토리얼/프리미엄 몰의 마무리.",
  },
  {
    id: "footer/warm-tinted",
    kind: "footer",
    name: "웜 틴트 푸터",
    observedIn: ["PTMD825692", "PTMD866663"],
    traits: "브랜드 웜 톤을 살짝 입힌 푸터. 식품·디저트 몰에서 관찰.",
  },
];

export function referencePatternById(id: string) {
  return REFERENCE_PATTERNS.find((pattern) => pattern.id === id);
}

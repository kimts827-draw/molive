/**
 * 업종 프로필입니다.
 *
 * 여기의 값은 "이 업종이면 이 페이지가 나온다"는 고정 템플릿이 아니라,
 * Page Plan을 만들 때 쓰는 가중치와 후보 풀입니다.
 * - AI planner가 살아 있으면: 후보 풀은 참고 자료로만 프롬프트에 실립니다.
 * - AI planner가 실패하면: plan-composer.ts가 이 가중치로 결정적 plan을 조합합니다.
 *
 * industryLabel(예: "프리미엄 건강기능식품")은 AI가 자유 텍스트로 정하고,
 * 여기의 id는 가중치 조회용 키일 뿐이라 이미지 프롬프트에 직접 들어가지 않습니다.
 * (이전 버전이 "food-dessert" 같은 내부 키를 이미지 프롬프트에 그대로 넣어
 *  식품 브리프가 전부 디저트 사진으로 쏠리던 원인입니다.)
 */

import type { SectionTypeId } from "./section-registry.ts";
import type { DensityId, FooterMoodId, HeaderStructureId, HeroVariantId, ImageTreatmentId, ProductPresentationId, TypeScaleId } from "./variants.ts";

export const INDUSTRY_IDS = [
  "fashion",
  "beauty",
  "food",
  "health",
  "auto",
  "interior",
  "household",
  "lifestyle",
  "pet",
  "kids",
  "sports",
  "digital",
  "general",
] as const;
export type IndustryId = (typeof INDUSTRY_IDS)[number];

export type IndustryProfile = {
  id: IndustryId;
  label: string;
  /** 업종 판정 키워드입니다. 소문자 비교합니다. */
  keywords: string[];
  /** 사용자가 실제 상품을 적었는지 알아내는 상품 명사입니다. 이미지 프롬프트 보존에 씁니다. */
  productNouns: string[];
  /** 이 업종에서 각 섹션이 뽑힐 상대 가중치입니다. 없는 항목은 자동 선택되지 않습니다. */
  sectionWeights: Partial<Record<SectionTypeId, number>>;
  /** 섹션 기본 위치(0~1)에 더해지는 업종별 보정입니다. 음수면 더 위로 올라갑니다. */
  positionShift: Partial<Record<SectionTypeId, number>>;
  heroPool: HeroVariantId[];
  headerPool: HeaderStructureId[];
  presentationPool: ProductPresentationId[];
  footerPool: FooterMoodId[];
  typeScalePool: TypeScaleId[];
  imageTreatmentPool: ImageTreatmentId[];
  densityPool: DensityId[];
  /** 본문 섹션 개수 범위(상품 진열 포함). */
  bodyCount: [number, number];
};

/** 섹션 타입의 기본 세로 위치입니다(0=도입 직후, 1=푸터 직전). */
export const SECTION_BASE_POSITION: Record<SectionTypeId, number> = {
  categoryGrid: 0.08,
  collection: 0.2,
  lookbook: 0.3,
  productFocus: 0.35,
  featuredProducts: 0.42,
  imageText: 0.52,
  brandStory: 0.5,
  materials: 0.56,
  useCases: 0.58,
  process: 0.62,
  specs: 0.64,
  editorialBanner: 0.66,
  promotion: 0.7,
  benefits: 0.74,
  gift: 0.76,
  infoGuide: 0.82,
  socialGallery: 0.86,
  cta: 0.96,
};

export const INDUSTRY_PROFILES: Record<IndustryId, IndustryProfile> = {
  fashion: {
    id: "fashion",
    label: "패션/의류",
    keywords: ["패션", "의류", "옷", "어패럴", "스트릿", "레디투웨어", "룩북", "컬렉션", "fashion", "apparel", "wear", "outer", "denim", "가방", "슈즈", "주얼리", "잡화"],
    productNouns: ["원피스", "코트", "니트", "재킷", "셔츠", "팬츠", "스커트", "가방", "슈즈", "주얼리", "데님", "블라우스"],
    sectionWeights: { lookbook: 5, collection: 4, brandStory: 3, categoryGrid: 2, editorialBanner: 3, socialGallery: 4, imageText: 3, materials: 2, cta: 4, promotion: 1, useCases: 1 },
    positionShift: { featuredProducts: 0.05, lookbook: -0.04 },
    heroPool: ["split-editorial", "typographic-marquee", "full-bleed", "cinematic-still"],
    headerPool: ["centered-brand", "overlay-minimal", "split-utility", "logo-center-row", "stacked-left"],
    presentationPool: ["editorial-two", "large-grid"],
    footerPool: ["ink-dark", "paper-light"],
    typeScalePool: ["serif-display", "sans-modern"],
    imageTreatmentPool: ["desaturated-editorial", "vivid-clean"],
    densityPool: ["airy", "regular"],
    bodyCount: [4, 6],
  },
  beauty: {
    id: "beauty",
    label: "뷰티/화장품",
    keywords: ["뷰티", "화장품", "스킨케어", "코스메틱", "세럼", "크림", "메이크업", "향수", "beauty", "cosmetic", "skincare", "perfume"],
    productNouns: ["세럼", "크림", "토너", "앰플", "클렌저", "선크림", "립", "쿠션", "향수", "마스크팩", "오일"],
    sectionWeights: { materials: 5, brandStory: 3, productFocus: 4, benefits: 3, infoGuide: 3, socialGallery: 3, collection: 2, editorialBanner: 2, cta: 4, useCases: 2, process: 2 },
    positionShift: { materials: -0.06, featuredProducts: 0.0 },
    heroPool: ["cinematic-still", "full-bleed", "split-editorial"],
    headerPool: ["centered-brand", "overlay-minimal", "logo-center-row"],
    presentationPool: ["grid-four", "editorial-two", "large-grid"],
    footerPool: ["paper-light", "ink-dark"],
    typeScalePool: ["sans-modern", "serif-display"],
    imageTreatmentPool: ["vivid-clean", "desaturated-editorial", "dark-cinematic"],
    densityPool: ["regular", "airy"],
    bodyCount: [5, 7],
  },
  food: {
    id: "food",
    label: "식품",
    keywords: ["식품", "먹거리", "농산", "축산", "수산", "정육", "반찬", "밀키트", "디저트", "베이커리", "케이크", "쿠키", "커피", "차", "티", "잼", "간식", "수제", "food", "bakery", "dessert", "grocery"],
    productNouns: ["한우", "쌀", "김치", "반찬", "밀키트", "커피", "원두", "차", "잼", "빵", "케이크", "쿠키", "초콜릿", "육포", "견과", "과일", "젓갈", "오일", "소스"],
    sectionWeights: { materials: 5, process: 4, gift: 4, brandStory: 3, productFocus: 3, benefits: 2, infoGuide: 2, categoryGrid: 2, promotion: 2, cta: 4, imageText: 2 },
    positionShift: { featuredProducts: 0.02, gift: 0.02 },
    heroPool: ["full-bleed", "cinematic-still", "banner-stack", "split-editorial"],
    headerPool: ["centered-brand", "split-utility", "overlay-minimal", "stacked-split"],
    presentationPool: ["featured-grid", "grid-four", "large-grid"],
    footerPool: ["warm-tinted", "ink-dark", "paper-light"],
    typeScalePool: ["rounded-warm", "serif-display", "sans-modern"],
    imageTreatmentPool: ["warm-film", "vivid-clean"],
    densityPool: ["regular", "airy"],
    bodyCount: [5, 7],
  },
  health: {
    id: "health",
    label: "건강기능식품",
    keywords: ["건강식품", "건강기능", "영양제", "비타민", "유산균", "홍삼", "프로틴", "보충제", "supplement", "vitamin"],
    productNouns: ["비타민", "유산균", "홍삼", "오메가", "프로틴", "콜라겐", "루테인", "밀크씨슬", "정", "분말"],
    sectionWeights: { materials: 5, benefits: 4, specs: 3, process: 3, infoGuide: 4, brandStory: 2, productFocus: 3, cta: 4, gift: 2, promotion: 2 },
    positionShift: { benefits: -0.08, featuredProducts: -0.02 },
    heroPool: ["product-forward", "full-bleed", "split-editorial"],
    headerPool: ["split-utility", "centered-brand", "stacked-left"],
    presentationPool: ["grid-four", "compact-five", "featured-grid"],
    footerPool: ["paper-light", "warm-tinted"],
    typeScalePool: ["sans-modern", "rounded-warm"],
    imageTreatmentPool: ["vivid-clean", "warm-film"],
    densityPool: ["regular", "dense"],
    bodyCount: [5, 7],
  },
  auto: {
    id: "auto",
    label: "자동차용품",
    keywords: ["자동차", "차량", "카", "모터", "튜닝", "세차", "디테일링", "블랙박스", "타이어", "auto", "car", "motor", "garage"],
    productNouns: ["카매트", "블랙박스", "세차용품", "왁스", "코팅제", "타이어", "휠", "썬팅", "방향제", "핸들커버", "트렁크매트", "공구"],
    sectionWeights: { specs: 5, categoryGrid: 4, productFocus: 3, benefits: 3, useCases: 3, infoGuide: 3, promotion: 2, brandStory: 2, cta: 4, editorialBanner: 2 },
    positionShift: { specs: -0.06, featuredProducts: -0.1, categoryGrid: -0.05 },
    heroPool: ["cinematic-still", "product-forward", "banner-stack"],
    headerPool: ["split-utility", "overlay-minimal", "stacked-left"],
    presentationPool: ["compact-five", "grid-four"],
    footerPool: ["ink-dark", "paper-light"],
    typeScalePool: ["sans-modern"],
    imageTreatmentPool: ["dark-cinematic", "vivid-clean"],
    densityPool: ["dense", "regular"],
    bodyCount: [5, 7],
  },
  interior: {
    id: "interior",
    label: "인테리어/가구",
    keywords: ["인테리어", "가구", "소파", "조명", "침대", "책상", "러그", "커튼", "데코", "홈스타일링", "interior", "furniture", "lighting"],
    productNouns: ["소파", "조명", "테이블", "의자", "침대", "러그", "커튼", "선반", "화병", "액자", "수납장", "원목"],
    sectionWeights: { lookbook: 5, useCases: 4, materials: 4, collection: 3, imageText: 3, specs: 3, brandStory: 3, infoGuide: 3, socialGallery: 2, cta: 3 },
    positionShift: { featuredProducts: 0.08, lookbook: -0.06 },
    heroPool: ["full-bleed", "split-editorial", "banner-stack", "cinematic-still"],
    headerPool: ["centered-brand", "split-utility", "logo-center-row", "stacked-left"],
    presentationPool: ["large-grid", "editorial-two", "grid-four"],
    footerPool: ["paper-light", "ink-dark"],
    typeScalePool: ["serif-display", "sans-modern"],
    imageTreatmentPool: ["desaturated-editorial", "vivid-clean", "warm-film"],
    densityPool: ["airy", "regular"],
    bodyCount: [5, 7],
  },
  household: {
    id: "household",
    label: "생활용품",
    keywords: ["생활용품", "주방", "욕실", "청소", "세제", "수납", "정리", "일회용", "위생", "household", "kitchen", "cleaning"],
    productNouns: ["수세미", "세제", "행주", "밀폐용기", "수납함", "청소포", "휴지", "물티슈", "칫솔", "빨래건조대", "주방칼", "도마"],
    sectionWeights: { categoryGrid: 5, useCases: 4, benefits: 4, promotion: 3, specs: 2, infoGuide: 3, imageText: 2, gift: 1, cta: 4, brandStory: 1 },
    positionShift: { featuredProducts: -0.14, categoryGrid: -0.06, benefits: -0.02 },
    heroPool: ["product-forward", "banner-stack", "full-bleed"],
    headerPool: ["split-utility", "centered-brand", "stacked-split"],
    presentationPool: ["compact-five", "grid-four", "featured-grid"],
    footerPool: ["paper-light", "warm-tinted"],
    typeScalePool: ["bold-retail", "sans-modern", "rounded-warm"],
    imageTreatmentPool: ["saturated-pop", "vivid-clean"],
    densityPool: ["dense", "regular"],
    bodyCount: [5, 7],
  },
  lifestyle: {
    id: "lifestyle",
    label: "라이프스타일/편집숍",
    keywords: ["라이프스타일", "편집숍", "셀렉트", "오브제", "문구", "리빙", "감성", "선물", "lifestyle", "select", "object", "stationery"],
    productNouns: ["오브제", "캔들", "디퓨저", "문구", "노트", "머그", "포스터", "패브릭", "트레이", "키링", "엽서"],
    sectionWeights: { collection: 4, brandStory: 4, imageText: 4, editorialBanner: 3, lookbook: 3, gift: 3, socialGallery: 3, categoryGrid: 2, cta: 4, useCases: 2 },
    positionShift: { featuredProducts: 0.04 },
    heroPool: ["banner-stack", "split-editorial", "typographic-marquee", "full-bleed"],
    headerPool: ["centered-brand", "split-utility", "overlay-minimal", "logo-center-row"],
    presentationPool: ["grid-four", "editorial-two", "large-grid"],
    footerPool: ["paper-light", "ink-dark", "warm-tinted"],
    typeScalePool: ["serif-display", "sans-modern", "rounded-warm"],
    imageTreatmentPool: ["desaturated-editorial", "vivid-clean", "warm-film"],
    densityPool: ["airy", "regular"],
    bodyCount: [4, 6],
  },
  pet: {
    id: "pet",
    label: "반려동물",
    keywords: ["반려", "펫", "강아지", "고양이", "댕댕", "냥", "사료", "간식", "pet", "dog", "cat"],
    productNouns: ["사료", "간식", "하네스", "리드줄", "방석", "장난감", "배변패드", "샴푸", "급수기", "캣타워", "스크래처"],
    sectionWeights: { categoryGrid: 5, useCases: 4, materials: 3, benefits: 3, socialGallery: 4, infoGuide: 3, promotion: 2, brandStory: 2, cta: 4, imageText: 2 },
    positionShift: { featuredProducts: -0.12, categoryGrid: -0.05, socialGallery: -0.02 },
    heroPool: ["product-forward", "full-bleed", "banner-stack"],
    headerPool: ["split-utility", "centered-brand", "stacked-split"],
    presentationPool: ["compact-five", "grid-four", "featured-grid"],
    footerPool: ["warm-tinted", "paper-light"],
    typeScalePool: ["rounded-warm", "bold-retail", "sans-modern"],
    imageTreatmentPool: ["saturated-pop", "vivid-clean", "warm-film"],
    densityPool: ["dense", "regular"],
    bodyCount: [5, 7],
  },
  kids: {
    id: "kids",
    label: "유아동",
    keywords: ["유아", "아동", "키즈", "아기", "베이비", "출산", "장난감", "토이", "어린이", "kids", "baby", "toy"],
    productNouns: ["젖병", "유모차", "카시트", "기저귀", "이유식", "블록", "인형", "내의", "바디슈트", "물티슈", "치발기", "턱받이"],
    sectionWeights: { categoryGrid: 5, materials: 4, benefits: 4, useCases: 3, gift: 3, infoGuide: 3, socialGallery: 2, brandStory: 2, cta: 4, promotion: 2 },
    positionShift: { featuredProducts: -0.06, categoryGrid: -0.05, materials: -0.04 },
    heroPool: ["full-bleed", "product-forward", "banner-stack"],
    headerPool: ["centered-brand", "split-utility", "logo-center-row"],
    presentationPool: ["featured-grid", "grid-four", "large-grid"],
    footerPool: ["warm-tinted", "paper-light"],
    typeScalePool: ["rounded-warm", "bold-retail", "sans-modern"],
    imageTreatmentPool: ["saturated-pop", "vivid-clean", "warm-film"],
    densityPool: ["regular", "dense"],
    bodyCount: [5, 7],
  },
  sports: {
    id: "sports",
    label: "스포츠/아웃도어",
    keywords: ["스포츠", "운동", "헬스", "요가", "필라테스", "등산", "캠핑", "아웃도어", "골프", "러닝", "sports", "outdoor", "camping", "golf"],
    productNouns: ["요가매트", "덤벨", "러닝화", "텐트", "침낭", "배낭", "골프공", "레깅스", "물통", "폴대", "랜턴"],
    sectionWeights: { specs: 4, useCases: 4, categoryGrid: 3, benefits: 3, materials: 3, lookbook: 2, promotion: 2, brandStory: 2, cta: 4, socialGallery: 2 },
    positionShift: { featuredProducts: -0.06, useCases: -0.04 },
    heroPool: ["cinematic-still", "full-bleed", "product-forward"],
    headerPool: ["split-utility", "overlay-minimal", "stacked-left"],
    presentationPool: ["large-grid", "grid-four", "compact-five"],
    footerPool: ["ink-dark", "paper-light"],
    typeScalePool: ["sans-modern"],
    imageTreatmentPool: ["dark-cinematic", "vivid-clean"],
    densityPool: ["regular", "dense"],
    bodyCount: [5, 7],
  },
  digital: {
    id: "digital",
    label: "디지털/가전",
    keywords: ["가전", "디지털", "전자", "테크", "기기", "이어폰", "키보드", "모니터", "충전", "스마트", "tech", "device", "gadget"],
    productNouns: ["이어폰", "키보드", "마우스", "모니터", "충전기", "케이블", "스피커", "허브", "케이스", "거치대", "보조배터리"],
    sectionWeights: { specs: 5, productFocus: 4, benefits: 3, categoryGrid: 3, useCases: 3, infoGuide: 3, promotion: 2, cta: 4, editorialBanner: 2 },
    positionShift: { specs: -0.08, featuredProducts: -0.04, categoryGrid: -0.04 },
    heroPool: ["cinematic-still", "product-forward", "split-editorial", "typographic-marquee"],
    headerPool: ["split-utility", "overlay-minimal", "stacked-split"],
    presentationPool: ["grid-four", "compact-five", "large-grid"],
    footerPool: ["ink-dark", "paper-light"],
    typeScalePool: ["sans-modern"],
    imageTreatmentPool: ["dark-cinematic", "vivid-clean"],
    densityPool: ["dense", "regular"],
    bodyCount: [5, 7],
  },
  general: {
    id: "general",
    label: "종합",
    keywords: [],
    productNouns: [],
    sectionWeights: { categoryGrid: 4, collection: 3, brandStory: 3, imageText: 3, benefits: 3, promotion: 3, editorialBanner: 2, socialGallery: 2, useCases: 2, cta: 4 },
    positionShift: { categoryGrid: -0.04 },
    heroPool: ["full-bleed", "banner-stack", "split-editorial", "product-forward", "typographic-marquee", "cinematic-still"],
    headerPool: ["split-utility", "centered-brand", "overlay-minimal", "logo-center-row", "stacked-left", "stacked-split"],
    presentationPool: ["grid-four", "large-grid", "editorial-two", "featured-grid", "compact-five"],
    footerPool: ["paper-light", "ink-dark", "warm-tinted"],
    typeScalePool: ["bold-retail", "sans-modern", "serif-display", "rounded-warm"],
    imageTreatmentPool: ["vivid-clean", "saturated-pop", "desaturated-editorial", "warm-film", "dark-cinematic"],
    densityPool: ["regular", "airy", "dense"],
    bodyCount: [4, 7],
  },
};

export function industryProfile(id: string): IndustryProfile {
  return INDUSTRY_PROFILES[id as IndustryId] ?? INDUSTRY_PROFILES.general;
}

export function isIndustryId(value: unknown): value is IndustryId {
  return typeof value === "string" && (INDUSTRY_IDS as readonly string[]).includes(value);
}

/**
 * 업종을 추론합니다.
 * 키워드 적중 수가 같으면 더 구체적인 업종(키워드가 긴 쪽)이 이기게 해
 * "건강식품"이 "식품"에 삼켜지지 않도록 합니다.
 */
export function inferIndustry(text: string): IndustryId {
  const haystack = text.toLowerCase();
  let best: { id: IndustryId; hits: number; specificity: number } = { id: "general", hits: 0, specificity: 0 };
  for (const id of INDUSTRY_IDS) {
    if (id === "general") continue;
    const profile = INDUSTRY_PROFILES[id];
    let hits = 0;
    let specificity = 0;
    for (const keyword of profile.keywords) {
      if (!haystack.includes(keyword.toLowerCase())) continue;
      hits += 1;
      specificity = Math.max(specificity, keyword.length);
    }
    if (hits > best.hits || (hits === best.hits && hits > 0 && specificity > best.specificity)) {
      best = { id, hits, specificity };
    }
  }
  return best.hits > 0 ? best.id : "general";
}

/**
 * 사용자가 브리프에 실제로 적은 상품 명사를 뽑습니다.
 * 이미지 생성 프롬프트가 상품군을 임의로 바꾸지 못하게 하는 근거로 씁니다.
 */
export function extractProductNouns(text: string, industry?: IndustryId): string[] {
  const pool = new Set<string>();
  for (const id of INDUSTRY_IDS) {
    if (industry && id !== industry && id !== "general") continue;
    for (const noun of INDUSTRY_PROFILES[id].productNouns) pool.add(noun);
  }
  const found = [...pool].filter((noun) => text.includes(noun));
  if (found.length) return found.slice(0, 6);
  // 업종을 좁혀서 못 찾으면 전체 사전으로 한 번 더 봅니다.
  if (industry) return extractProductNouns(text);
  return [];
}

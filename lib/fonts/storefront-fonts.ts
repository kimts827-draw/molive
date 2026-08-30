export type StorefrontFontMood = "modern" | "playful" | "editorial" | "premium" | "technical" | "friendly" | "bold" | "warm";
export type StorefrontFontCategory = "gothic" | "rounded" | "display" | "serif";
export type StorefrontFontTarget = "preview" | "cafe24";

export type StorefrontFontFile = {
  fileName: string;
  weight: string;
  style: "normal";
};

export type StorefrontFontDefinition = {
  id: string;
  label: string;
  family: string;
  stack: string;
  category: StorefrontFontCategory;
  moods: readonly StorefrontFontMood[];
  usage: string;
  files: readonly StorefrontFontFile[];
  officialSource: string;
  licenseUrl: string;
  license: "SIL Open Font License 1.1";
  distribution: "official-woff2" | "ofl-format-conversion";
};

/**
 * Editor, AI generation, Preview, Cafe24 ZIP이 함께 쓰는 단일 폰트 레지스트리입니다.
 * stack은 저장되는 값이므로 변경하지 않습니다. 새 폰트는 반드시 OFL 원문과 파일을
 * public/fonts/storefront/<id>/ 아래에 함께 추가해야 합니다.
 */
export const STOREFRONT_FONTS = [
  {
    id: "pretendard",
    label: "Pretendard",
    family: "Pretendard",
    stack: "'Pretendard', sans-serif",
    category: "gothic",
    moods: ["modern", "premium"],
    usage: "패션·뷰티·라이프스타일 전반의 본문과 UI",
    files: [{ fileName: "PretendardVariable.woff2", weight: "45 930", style: "normal" }],
    officialSource: "https://github.com/orioncactus/pretendard",
    licenseUrl: "https://github.com/orioncactus/pretendard/blob/main/LICENSE",
    license: "SIL Open Font License 1.1",
    distribution: "official-woff2",
  },
  {
    id: "noto-sans-kr",
    label: "Noto Sans KR",
    family: "Noto Sans KR",
    stack: "'Noto Sans KR', sans-serif",
    category: "gothic",
    moods: ["modern", "friendly"],
    usage: "카테고리 제약이 적은 중립적 본문과 상품 정보",
    files: [{ fileName: "NotoSansKR-Variable.woff2", weight: "100 900", style: "normal" }],
    officialSource: "https://github.com/google/fonts/tree/main/ofl/notosanskr",
    licenseUrl: "https://github.com/google/fonts/blob/main/ofl/notosanskr/OFL.txt",
    license: "SIL Open Font License 1.1",
    distribution: "ofl-format-conversion",
  },
  {
    id: "ibm-plex-sans-kr",
    label: "IBM Plex Sans KR",
    family: "IBM Plex Sans KR",
    stack: "'IBM Plex Sans KR', sans-serif",
    category: "gothic",
    moods: ["technical", "modern"],
    usage: "디지털·가전·자동차·기능 중심 브랜드",
    files: [
      { fileName: "IBMPlexSansKR-Regular.woff2", weight: "400", style: "normal" },
      { fileName: "IBMPlexSansKR-Bold.woff2", weight: "700", style: "normal" },
    ],
    officialSource: "https://github.com/IBM/plex/tree/master/packages/plex-sans-kr",
    licenseUrl: "https://github.com/IBM/plex/blob/master/packages/plex-sans-kr/LICENSE.txt",
    license: "SIL Open Font License 1.1",
    distribution: "official-woff2",
  },
  {
    id: "gowun-dodum",
    label: "고운돋움",
    family: "Gowun Dodum",
    stack: "'Gowun Dodum', sans-serif",
    category: "rounded",
    moods: ["friendly", "warm"],
    usage: "리빙·푸드·키즈의 부드럽고 편안한 본문",
    files: [{ fileName: "GowunDodum-Regular.woff2", weight: "400", style: "normal" }],
    officialSource: "https://github.com/google/fonts/tree/main/ofl/gowundodum",
    licenseUrl: "https://github.com/google/fonts/blob/main/ofl/gowundodum/OFL.txt",
    license: "SIL Open Font License 1.1",
    distribution: "ofl-format-conversion",
  },
  {
    id: "jua",
    label: "주아",
    family: "Jua",
    stack: "'Jua', sans-serif",
    category: "rounded",
    moods: ["playful", "friendly"],
    usage: "키즈·펫·푸드의 로고와 짧은 프로모션 제목",
    files: [{ fileName: "Jua-Regular.woff2", weight: "400", style: "normal" }],
    officialSource: "https://github.com/google/fonts/tree/main/ofl/jua",
    licenseUrl: "https://github.com/google/fonts/blob/main/ofl/jua/OFL.txt",
    license: "SIL Open Font License 1.1",
    distribution: "ofl-format-conversion",
  },
  {
    id: "black-han-sans",
    label: "검은고딕",
    family: "Black Han Sans",
    stack: "'Black Han Sans', sans-serif",
    category: "display",
    moods: ["bold", "modern"],
    usage: "스트리트·스포츠·세일 캠페인의 강한 한 줄 제목",
    files: [{ fileName: "BlackHanSans-Regular.woff2", weight: "400", style: "normal" }],
    officialSource: "https://github.com/google/fonts/tree/main/ofl/blackhansans",
    licenseUrl: "https://github.com/google/fonts/blob/main/ofl/blackhansans/OFL.txt",
    license: "SIL Open Font License 1.1",
    distribution: "ofl-format-conversion",
  },
  {
    id: "noto-serif-kr",
    label: "Noto Serif KR",
    family: "Noto Serif KR",
    stack: "'Noto Serif KR', serif",
    category: "serif",
    moods: ["editorial", "premium"],
    usage: "매거진형 패션·뷰티와 긴 브랜드 스토리",
    files: [{ fileName: "NotoSerifKR-Variable.woff2", weight: "200 900", style: "normal" }],
    officialSource: "https://github.com/google/fonts/tree/main/ofl/notoserifkr",
    licenseUrl: "https://github.com/google/fonts/blob/main/ofl/notoserifkr/OFL.txt",
    license: "SIL Open Font License 1.1",
    distribution: "ofl-format-conversion",
  },
  {
    id: "gowun-batang",
    label: "고운바탕",
    family: "Gowun Batang",
    stack: "'Gowun Batang', serif",
    category: "serif",
    moods: ["warm", "editorial"],
    usage: "식품·공예·전통 소재의 따뜻한 스토리텔링",
    files: [
      { fileName: "GowunBatang-Regular.woff2", weight: "400", style: "normal" },
      { fileName: "GowunBatang-Bold.woff2", weight: "700", style: "normal" },
    ],
    officialSource: "https://github.com/google/fonts/tree/main/ofl/gowunbatang",
    licenseUrl: "https://github.com/google/fonts/blob/main/ofl/gowunbatang/OFL.txt",
    license: "SIL Open Font License 1.1",
    distribution: "ofl-format-conversion",
  },
  {
    id: "hahmlet",
    label: "함렛",
    family: "Hahmlet",
    stack: "'Hahmlet', serif",
    category: "serif",
    moods: ["premium", "editorial"],
    usage: "주얼리·호텔·프리미엄 식품의 현대적 명조 제목",
    files: [{ fileName: "Hahmlet-Variable.woff2", weight: "100 900", style: "normal" }],
    officialSource: "https://github.com/google/fonts/tree/main/ofl/hahmlet",
    licenseUrl: "https://github.com/google/fonts/blob/main/ofl/hahmlet/OFL.txt",
    license: "SIL Open Font License 1.1",
    distribution: "ofl-format-conversion",
  },
] as const satisfies readonly StorefrontFontDefinition[];

export const STOREFRONT_FONT_FAMILY_VALUES = STOREFRONT_FONTS.map((font) => font.stack) as [string, ...string[]];
export const STOREFRONT_FONT_FAMILY_SET = new Set<string>(STOREFRONT_FONT_FAMILY_VALUES);

export function storefrontFontAssetPath(fontId: string, fileName: string) {
  return `fonts/storefront/${fontId}/${fileName}`;
}

export function buildStorefrontFontFaceCss(target: StorefrontFontTarget) {
  const prefix = target === "preview" ? "/fonts/storefront" : "../fonts/storefront";
  return `/* MOLIVE storefront fonts — bundled under SIL OFL 1.1 */\n${STOREFRONT_FONTS.flatMap((font) => font.files.map((file) => `@font-face{font-family:${JSON.stringify(font.family)};src:url("${prefix}/${font.id}/${file.fileName}") format("woff2");font-style:${file.style};font-weight:${file.weight};font-display:swap}`)).join("\n")}`;
}

export function storefrontFontPrompt() {
  return STOREFRONT_FONTS.map((font) => `- ${font.stack}: ${font.category}; moods=${font.moods.join("/")}; use=${font.usage}`).join("\n");
}

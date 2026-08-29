export type TemplateItem = {
  id: string;
  title: string;
  category: string;
  mood: string;
  brandColor: `#${string}`;
  prompt: string;
  image: {
    src: string;
    width: number;
    height: number;
    position: string;
  };
};

export const templateCatalog: readonly TemplateItem[] = [
  {
    id: "soft-baby",
    title: "포근한 베이비 라이프",
    category: "유아동 / 베이비",
    mood: "포근하고 부드러운 분위기",
    brandColor: "#D8C3A9",
    prompt: "따뜻한 크림색과 베이지를 중심으로 신뢰감 있고 포근한 베이비 용품 쇼핑몰을 만들어줘. 여백을 넉넉하게 사용하고 부드러운 곡선, 자연광 제품 사진, 선물하기 좋은 상품 큐레이션이 잘 보이게 구성해줘.",
    image: { src: "/templates/baby.png", width: 1027, height: 5307, position: "50% 0%" },
  },
  {
    id: "playful-kids",
    title: "컬러풀 키즈 플레이",
    category: "유아동 / 키즈",
    mood: "밝고 경쾌한 분위기",
    brandColor: "#F4C84A",
    prompt: "아이들의 활기찬 에너지가 느껴지는 키즈 패션 쇼핑몰을 만들어줘. 선명한 포인트 컬러와 발랄한 타이포그래피를 사용하고 신상품, 인기 코디, 연령별 추천 상품을 한눈에 찾을 수 있게 구성해줘.",
    image: { src: "/templates/kids.png", width: 1027, height: 4854, position: "50% 0%" },
  },
  {
    id: "urban-street",
    title: "어반 스트리트 에디트",
    category: "패션 / 스트리트",
    mood: "대담하고 감각적인 분위기",
    brandColor: "#171717",
    prompt: "도시적이고 대담한 스트리트 패션 브랜드 쇼핑몰을 만들어줘. 블랙과 뉴트럴 컬러를 기반으로 강한 타이포그래피, 룩북형 비주얼, 신상품 드롭과 스타일링 콘텐츠가 돋보이게 구성해줘.",
    image: { src: "/templates/streetfashion.png", width: 1027, height: 6290, position: "50% 0%" },
  },
  {
    id: "minimal-jewelry",
    title: "타임리스 주얼리",
    category: "패션잡화 / 주얼리",
    mood: "정제되고 고급스러운 분위기",
    brandColor: "#B7A27A",
    prompt: "절제된 고급스러움이 느껴지는 데일리 주얼리 쇼핑몰을 만들어줘. 아이보리와 골드 포인트를 사용하고 제품의 디테일이 크게 보이는 사진, 컬렉션 소개, 베스트 상품과 브랜드 스토리가 자연스럽게 이어지게 구성해줘.",
    image: { src: "/templates/jewelry.png", width: 1027, height: 8347, position: "50% 0%" },
  },
] as const;

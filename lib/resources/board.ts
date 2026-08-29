export type ResourceBoardKey = "notice" | "template" | "blog" | "resource";

export type ResourceBoardMeta = {
  key: ResourceBoardKey;
  label: string;
  eyebrow: string;
  href: string;
  description: string;
  intro: string;
  empty: string;
};

/** 자료실 메뉴 순서: 공지사항 → 템플릿 → 블로그 → 자료모음 */
export const RESOURCE_BOARDS: readonly ResourceBoardMeta[] = [
  {
    key: "notice",
    label: "공지사항",
    eyebrow: "NOTICE",
    href: "/notice",
    description: "MOLIVE 업데이트와 주요 안내",
    intro: "서비스 업데이트와 점검, 정책 변경 안내를 확인하세요.",
    empty: "아직 등록된 공지사항이 없습니다.",
  },
  {
    key: "template",
    label: "템플릿",
    eyebrow: "TEMPLATES",
    href: "/templates",
    description: "업종별 완성 예시와 생성 프롬프트",
    intro: "다양한 업종의 완성 예시와 브랜드 컬러, 생성 프롬프트를 확인하고\n내 쇼핑몰을 위한 출발점으로 활용해보세요.",
    empty: "아직 등록된 템플릿이 없습니다.",
  },
  {
    key: "blog",
    label: "블로그",
    eyebrow: "BLOG",
    href: "/blog",
    description: "Cafe24와 소규모 쇼핑몰 운영에 도움되는 글",
    intro: "Cafe24와 작은 쇼핑몰 운영에 도움이 되는 글을 모았습니다.",
    empty: "Cafe24와 작은 쇼핑몰 운영에 도움이 되는 글을 준비하고 있습니다.",
  },
  {
    key: "resource",
    label: "자료모음",
    eyebrow: "RESOURCES",
    href: "/resources",
    description: "운영에 바로 쓰는 체크리스트와 자료",
    intro: "쇼핑몰 운영에 바로 사용할 수 있는 자료를 모았습니다.",
    empty: "쇼핑몰 운영에 바로 사용할 수 있는 자료를 준비하고 있습니다.",
  },
] as const;

export const RESOURCE_BOARD_KEYS = RESOURCE_BOARDS.map((board) => board.key) as ResourceBoardKey[];

export function resourceBoard(key: ResourceBoardKey): ResourceBoardMeta {
  const board = RESOURCE_BOARDS.find((item) => item.key === key);
  if (!board) throw new Error(`알 수 없는 자료실 게시판입니다: ${key}`);
  return board;
}

export function isResourceBoardKey(value: unknown): value is ResourceBoardKey {
  return typeof value === "string" && RESOURCE_BOARD_KEYS.includes(value as ResourceBoardKey);
}

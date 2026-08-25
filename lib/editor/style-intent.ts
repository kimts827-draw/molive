/**
 * Editor AI 채팅의 결정적 처리 층입니다.
 *
 * 초보자가 쓰는 평범한 한국어 요청 중 결과가 하나로 정해지는 것들은 모델을 부르지 않고
 * 여기서 바로 CSS 선언이나 Header variant 변경으로 바꿉니다. 모델 왕복이 없으니
 * 스키마 실패·보호검사 오탐·"성공했다는데 안 바뀜"이 생기지 않습니다.
 * 여기서 해석되지 않는 요청만 모델로 넘어갑니다.
 */

export type EditorHeaderVariant = "split-utility" | "centered-brand" | "overlay-minimal";

export type EditorIntentMetrics = {
  width: number;
  height: number;
  fontSize: number;
};

export type EditorIntentNode = {
  tagName: string;
  type: string;
  insideProductSlot?: boolean;
  /** Preview에서만 존재하는 Header 가상 노드입니다. */
  isHeader?: boolean;
  /** 현재 상품 썸네일 비율 override 값입니다. 상대 조절의 기준이 됩니다. */
  thumbRatio?: string;
  /** 현재 적용된 translate 값입니다. 상대 이동을 누적할 때 씁니다. */
  translate?: string;
  scale?: string;
};

export type EditorIntent =
  | { kind: "style"; declarations: Record<string, string>; summary: string }
  | { kind: "product-thumbnail"; thumbRatio: string; summary: string }
  | { kind: "header-variant"; variant: EditorHeaderVariant; summary: string }
  | { kind: "unsupported"; message: string }
  | { kind: "model" };

const NUMBER = String.raw`(\d+(?:\.\d+)?)`;

function firstMatch(prompt: string, pattern: RegExp) {
  return prompt.match(pattern);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function pxParts(value: string | undefined) {
  const parts = (value ?? "").trim().split(/\s+/);
  const parse = (part: string | undefined) => {
    const parsed = Number.parseFloat(part ?? "");
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return [parse(parts[0]), parse(parts[1])] as const;
}

function scaleValue(value: string | undefined) {
  const parts = (value ?? "").trim().split(/\s+/).map(Number);
  return Number.isFinite(parts[0]) && parts[0] > 0 ? parts[0] : 1;
}

/** 헤더는 AI 소스가 아니라 HeaderV1 variant가 소유하므로 variant 교체로만 바뀝니다. */
function headerIntent(prompt: string, node: EditorIntentNode): EditorIntent | null {
  // Header를 선택한 상태면 "헤더"라는 말을 하지 않아도 헤더 요청으로 봅니다.
  if (!node.isHeader && !/헤더|header|상단\s*바|네비게이션|navigation/i.test(prompt)) return null;
  if (/두\s*줄|2\s*줄|이단|two[- ]?row|가운데|중앙|센터|center/i.test(prompt)) {
    return { kind: "header-variant", variant: "centered-brand", summary: "헤더를 로고 행과 메뉴 행이 나뉜 두 줄 형식(centered-brand)으로 바꿨습니다." };
  }
  if (/한\s*줄|1\s*줄|한줄|컴팩트|compact|single[- ]?row/i.test(prompt)) {
    return { kind: "header-variant", variant: "split-utility", summary: "헤더를 한 줄 컴팩트 형식(split-utility)으로 바꿨습니다." };
  }
  if (/오버레이|투명|overlay|겹치/i.test(prompt)) {
    return { kind: "header-variant", variant: "overlay-minimal", summary: "헤더를 Hero 위에 겹치는 투명 형식(overlay-minimal)으로 바꿨습니다." };
  }
  return {
    kind: "unsupported",
    message: "헤더는 Cafe24 로그인·장바구니 기능이 붙어 있어 구조가 고정되어 있습니다. 지금 바꿀 수 있는 형태는 '두 줄', '한 줄', '오버레이' 세 가지입니다.",
  };
}

const DIRECTIONS: ReadonlyArray<readonly [RegExp, "up" | "down" | "left" | "right"]> = [
  [/위쪽?으?로|위로|올려|up/i, "up"],
  [/아래쪽?으?로|아래로|내려|down/i, "down"],
  [/왼쪽으?로|좌측으?로|left/i, "left"],
  [/오른쪽으?로|우측으?로|right/i, "right"],
];

function moveIntent(prompt: string, node: EditorIntentNode): EditorIntent | null {
  const direction = DIRECTIONS.find(([pattern]) => pattern.test(prompt))?.[1];
  if (!direction) return null;
  if (!/옮|이동|move|내려|올려|shift/i.test(prompt) && !new RegExp(`${NUMBER}\\s*(?:px|픽셀)`).test(prompt)) return null;
  const amount = Number(firstMatch(prompt, new RegExp(`${NUMBER}\\s*(?:px|픽셀)?`))?.[1] ?? "");
  if (!Number.isFinite(amount) || amount === 0) return null;
  const [currentX, currentY] = pxParts(node.translate);
  const nextX = direction === "left" ? currentX - amount : direction === "right" ? currentX + amount : currentX;
  const nextY = direction === "up" ? currentY - amount : direction === "down" ? currentY + amount : currentY;
  const label = { up: "위로", down: "아래로", left: "왼쪽으로", right: "오른쪽으로" }[direction];
  return {
    kind: "style",
    declarations: { translate: `${round(nextX)}px ${round(nextY)}px` },
    summary: `선택한 영역을 ${label} ${amount}px 옮겼습니다. 화면 밖으로 나간 부분은 잘려서 좌우 여백이 생기지 않습니다.`,
  };
}

/** 상품 썸네일을 가리키는 말. 이게 있으면 섹션 높이가 아니라 썸네일 상자를 바꿉니다. */
const PRODUCT_THUMBNAIL_TARGET = /썸네일|상품\s*(?:이미지|사진|컷)|제품\s*(?:이미지|사진|컷)|product\s*(?:thumb|image)/i;
/** 섹션·레이아웃 자체를 가리키는 말. 썸네일 표현과 겹칠 때 어느 쪽인지 가릅니다. */
const SECTION_TARGET = /섹션|영역|레이아웃|section|블록|칸/i;

/**
 * 세로로 긴 것부터 가로로 긴 것까지의 사다리입니다.
 * "늘려/줄여"처럼 숫자가 없는 요청은 이 사다리에서 한 칸씩 움직입니다.
 */
const THUMB_RATIO_LADDER = ["16/9", "3/2", "4/3", "1/1", "4/5", "3/4", "2/3", "9/16"] as const;

function ratioHeightFactor(ratio: string) {
  const [width, height] = ratio.split("/").map(Number);
  return width > 0 && height > 0 ? height / width : 1;
}

function closestLadderIndex(ratio: string | undefined) {
  const factor = ratio ? ratioHeightFactor(ratio) : 1;
  let best = THUMB_RATIO_LADDER.indexOf("1/1");
  let bestGap = Infinity;
  for (const [index, candidate] of THUMB_RATIO_LADDER.entries()) {
    const gap = Math.abs(ratioHeightFactor(candidate) - factor);
    if (gap < bestGap) { bestGap = gap; best = index; }
  }
  return best;
}

/**
 * 상품 썸네일 요청입니다. Product section 전체 높이가 아니라 썸네일 상자의 표시 비율만 바꿉니다.
 * Cafe24 상품 binding과 카드 DOM은 그대로 두고 CSS aspect-ratio만 다시 선언합니다.
 */
function productThumbnailIntent(prompt: string, node: EditorIntentNode): EditorIntent | null {
  if (!PRODUCT_THUMBNAIL_TARGET.test(prompt)) return null;
  // 섹션·레이아웃을 함께 말하면 썸네일이 아니라 그 영역의 높이 요청입니다.
  if (SECTION_TARGET.test(prompt)) return null;
  if (!/세로폭|세로\s*길이|높이|비율|크기|길게|짧게|정사각|가로폭|너비|크게|작게|늘려|줄여|키워/i.test(prompt)) return null;

  const explicit = firstMatch(prompt, new RegExp(`${NUMBER}\\s*[:/]\\s*${NUMBER}`));
  if (explicit) {
    const ratio = `${Number(explicit[1])}/${Number(explicit[2])}`;
    return { kind: "product-thumbnail", thumbRatio: ratio, summary: `상품 썸네일 표시 비율을 ${ratio.replace("/", ":")}로 바꿨습니다. 상품 데이터와 카드 구조는 그대로입니다.` };
  }
  if (/정사각|square|1\s*대\s*1/i.test(prompt)) {
    return { kind: "product-thumbnail", thumbRatio: "1/1", summary: "상품 썸네일을 정사각형(1:1)으로 맞췄습니다. 상품 데이터와 카드 구조는 그대로입니다." };
  }

  const taller = /늘려|길게|키워|높여|크게|세로형/i.test(prompt);
  const shorter = /줄여|짧게|낮춰|작게|가로형/i.test(prompt);
  if (!taller && !shorter) return null;
  const index = closestLadderIndex(node.thumbRatio);
  const nextIndex = Math.min(THUMB_RATIO_LADDER.length - 1, Math.max(0, index + (taller ? 1 : -1)));
  const ratio = THUMB_RATIO_LADDER[nextIndex];
  if (nextIndex === index) {
    return { kind: "unsupported", message: `상품 썸네일 비율이 이미 ${ratio.replace("/", ":")}로 끝단입니다. 더 조절하려면 "상품 썸네일 3:4" 처럼 비율을 직접 말씀해 주세요.` };
  }
  return {
    kind: "product-thumbnail",
    thumbRatio: ratio,
    summary: `상품 썸네일 표시 비율을 ${ratio.replace("/", ":")}로 ${taller ? "더 세로로" : "더 가로로"} 바꿨습니다. 섹션 높이와 상품 데이터는 직접 바꾸지 않았고, 썸네일이 길어진 만큼만 자연스럽게 늘어납니다.`,
  };
}

function heightIntent(prompt: string, node: EditorIntentNode, metrics?: EditorIntentMetrics): EditorIntent | null {
  if (!/세로폭|세로\s*길이|높이|height|길게|짧게/i.test(prompt)) return null;
  // 썸네일을 가리키는 요청은 섹션 높이로 처리하지 않습니다. 섹션을 함께 말했을 때만 넘어옵니다.
  if (PRODUCT_THUMBNAIL_TARGET.test(prompt) && !SECTION_TARGET.test(prompt)) return null;
  void node;
  const ratio = Number(firstMatch(prompt, new RegExp(`${NUMBER}\\s*(?:배|x|times)`))?.[1] ?? "");
  const absolute = Number(firstMatch(prompt, new RegExp(`${NUMBER}\\s*(?:px|픽셀)`))?.[1] ?? "");
  if (Number.isFinite(absolute) && absolute > 0) {
    const pixels = `${Math.round(absolute)}px`;
    return { kind: "style", declarations: { height: pixels, "min-height": pixels }, summary: `세로폭을 ${Math.round(absolute)}px로 맞췄습니다.` };
  }
  const step = /늘려|높여|길게|키워|크게/i.test(prompt) ? 1.2 : /줄여|낮춰|짧게|작게/i.test(prompt) ? 0.8 : null;
  const factor = Number.isFinite(ratio) && ratio > 0 ? ratio : step;
  if (!factor) return null;
  if (!metrics?.height) {
    return { kind: "unsupported", message: "현재 높이를 읽지 못했습니다. 미리보기에서 영역을 한 번 클릭해 선택한 뒤 다시 말씀해 주세요." };
  }
  const pixels = `${Math.round(metrics.height * factor)}px`;
  return {
    kind: "style",
    declarations: { height: pixels, "min-height": pixels },
    summary: `세로폭을 현재 ${Math.round(metrics.height)}px의 ${factor}배인 ${pixels}로 바꿨습니다. 태블릿·모바일은 기존 반응형 규칙을 그대로 씁니다.`,
  };
}

function fontSizeIntent(prompt: string, metrics?: EditorIntentMetrics): EditorIntent | null {
  if (PRODUCT_THUMBNAIL_TARGET.test(prompt)) return null;
  if (!/글씨|글자|폰트|텍스트\s*크기|font/i.test(prompt)) return null;
  const absolute = Number(firstMatch(prompt, new RegExp(`${NUMBER}\\s*(?:px|픽셀)`))?.[1] ?? "");
  if (Number.isFinite(absolute) && absolute > 0) {
    return { kind: "style", declarations: { "font-size": `${Math.round(absolute)}px` }, summary: `글자 크기를 ${Math.round(absolute)}px로 바꿨습니다.` };
  }
  const ratio = Number(firstMatch(prompt, new RegExp(`${NUMBER}\\s*(?:배|x)`))?.[1] ?? "");
  const step = /크게|키워|늘려/i.test(prompt) ? 1.25 : /작게|줄여|축소/i.test(prompt) ? 0.8 : null;
  const factor = Number.isFinite(ratio) && ratio > 0 ? ratio : step;
  if (!factor) return null;
  if (!metrics?.fontSize) {
    return { kind: "unsupported", message: "현재 글자 크기를 읽지 못했습니다. 미리보기에서 텍스트를 한 번 클릭해 선택한 뒤 다시 말씀해 주세요." };
  }
  const next = Math.max(6, Math.round(metrics.fontSize * factor));
  return {
    kind: "style",
    declarations: { "font-size": `${next}px` },
    summary: `글자 크기를 현재 ${Math.round(metrics.fontSize)}px에서 ${next}px로 바꿨습니다.`,
  };
}

function scaleIntent(prompt: string, node: EditorIntentNode): EditorIntent | null {
  // 상품 썸네일 요청은 선택 노드 배율이 아니라 썸네일 비율로 갑니다.
  if (PRODUCT_THUMBNAIL_TARGET.test(prompt)) return null;
  if (!/확대|축소|배율|크기를?\s*(?:키워|줄여)|크게|작게|scale/i.test(prompt)) return null;
  const percent = Number(firstMatch(prompt, new RegExp(`${NUMBER}\\s*%`))?.[1] ?? "");
  const ratio = Number(firstMatch(prompt, new RegExp(`${NUMBER}\\s*(?:배|x)`))?.[1] ?? "");
  const current = scaleValue(node.scale);
  const step = /확대|크게|키워/i.test(prompt) ? 1.2 : /축소|작게|줄여/i.test(prompt) ? 0.8 : null;
  const factor = Number.isFinite(percent) && percent > 0
    ? percent / 100
    : Number.isFinite(ratio) && ratio > 0
      ? ratio
      : step ? round(current * step) : null;
  if (!factor || factor <= 0) return null;
  return {
    kind: "style",
    declarations: { scale: `${round(factor)}` },
    summary: `크기를 ${Math.round(factor * 100)}%로 바꿨습니다. 중앙을 기준으로 커지고 작아집니다.`,
  };
}

function productGuardIntent(prompt: string, node: EditorIntentNode): EditorIntent | null {
  if (!node.insideProductSlot) return null;
  if (!/이미지|사진|썸네일|상품명|가격/i.test(prompt)) return null;
  return {
    kind: "unsupported",
    message: "상품 카드의 사진과 상품 값은 Cafe24 상품 데이터가 소유해서 Editor에서 바꾸지 않습니다. 상품 영역을 감싸는 섹션의 배경·여백·제목은 바꿀 수 있습니다.",
  };
}

/**
 * 요청을 결정적 편집으로 바꿉니다.
 * 해석되지 않으면 "model"을 돌려주어 기존 AI 편집 경로로 넘깁니다.
 */
export function resolveEditorIntent(input: {
  prompt: string;
  node: EditorIntentNode;
  metrics?: EditorIntentMetrics;
}): EditorIntent {
  const prompt = input.prompt.trim();
  if (!prompt) return { kind: "model" };
  const resolvers = [
    // 썸네일 표시 비율은 지원하는 편집이므로 상품 보호 안내보다 먼저 봅니다.
    () => productThumbnailIntent(prompt, input.node),
    () => productGuardIntent(prompt, input.node),
    () => headerIntent(prompt, input.node),
    () => moveIntent(prompt, input.node),
    () => heightIntent(prompt, input.node, input.metrics),
    () => fontSizeIntent(prompt, input.metrics),
    () => scaleIntent(prompt, input.node),
  ];
  for (const resolve of resolvers) {
    const intent = resolve();
    if (intent) return intent;
  }
  return { kind: "model" };
}

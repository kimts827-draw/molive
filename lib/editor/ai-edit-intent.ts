const STYLE_WORDS = /(?:font|폰트|글씨|서체|색상?|컬러|크기|size|굵기|weight|정렬|align|간격|행간|자간|여백|margin|padding|높이|세로폭|가로폭|너비|비율|ratio|위로|아래로|오른쪽|왼쪽|중앙|옮겨|이동|배율|늘려|줄여)/i;
const CONTENT_OR_STRUCTURE_WORDS = /(?:내용|문구|카피|문장|다시\s*써|작성해|추가|삭제|교체|구조를|레이아웃을\s*(?:새로|교체|재설계)|섹션을\s*(?:추가|삭제|교체)|버튼을\s*(?:추가|삭제|교체)|링크를\s*(?:추가|삭제|교체)|새롭게|완전히|재설계)/i;

export type AiEditIntent = "style-only" | "general";

export function classifyAiEditIntent(prompt: string): AiEditIntent {
  return STYLE_WORDS.test(prompt) && !CONTENT_OR_STRUCTURE_WORDS.test(prompt) ? "style-only" : "general";
}

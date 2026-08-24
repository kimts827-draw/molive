export type AutosaveState = "demo" | "saving" | "saved" | "error";

export function autosaveLabel(state: AutosaveState, lastSavedAt: string | null) {
  if (state === "demo") return "개발 데모 · 저장 안 됨";
  if (state === "saving") return "저장 중...";
  if (state === "error") return "저장 실패";
  if (!lastSavedAt) return "저장됨";
  return `저장됨 · ${new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(lastSavedAt))}`;
}

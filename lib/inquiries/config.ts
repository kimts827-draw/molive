export const INQUIRY_CATEGORIES = [
  { value: "service", label: "서비스 문의" },
  { value: "billing", label: "결제·Credit" },
  { value: "bug", label: "오류 신고" },
  { value: "feature", label: "기능 건의" },
  { value: "other", label: "기타" },
] as const;

export type InquiryCategory = typeof INQUIRY_CATEGORIES[number]["value"];
export type InquiryStatus = "pending" | "resolved";

export const INQUIRY_CATEGORY_LABELS = Object.fromEntries(
  INQUIRY_CATEGORIES.map(({ value, label }) => [value, label]),
) as Record<InquiryCategory, string>;

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  pending: "답변 대기",
  resolved: "처리 완료",
};

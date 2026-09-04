import { DEFAULT_PRICE_GROUP, PLAN_IDS, planPrice, type PlanId } from "../growth/pricing-config.ts";

export const CREDIT_COSTS = {
  designGeneration: 10,
  editorAi: 1,
} as const;

/** 플랜의 이름·추천 표시만 여기서 정한다. 가격과 Credit 수량은 pricing-config가 소유한다. */
const PLAN_LABELS = {
  starter: { name: "Starter", recommended: false },
  standard: { name: "Standard", recommended: true },
  studio: { name: "Studio", recommended: false },
} as const satisfies Record<PlanId, { name: string; recommended: boolean }>;

export type CreditPlanId = PlanId;
export type CreditPlan = { id: CreditPlanId; name: string; price: number; credits: number; recommended: boolean };
export type CreditOperation = "design_generation" | "editor_ai";

export const CREDIT_PLAN_IDS = PLAN_IDS;

/** 가격 실험군별 플랜 목록. 결제 화면은 반드시 이 함수를 거쳐 가격을 표시한다. */
export function creditPlansFor(priceGroup: string | null | undefined): CreditPlan[] {
  return PLAN_IDS.map((id) => ({ id, ...PLAN_LABELS[id], ...planPrice(priceGroup, id) }));
}

export function creditPlanFor(priceGroup: string | null | undefined, planId: string): CreditPlan | null {
  return creditPlansFor(priceGroup).find((plan) => plan.id === planId) ?? null;
}

export const CREDIT_PLANS: CreditPlan[] = creditPlansFor(DEFAULT_PRICE_GROUP);

export function creditPlan(planId: string) {
  return creditPlanFor(DEFAULT_PRICE_GROUP, planId);
}

export function creditCost(operation: CreditOperation) {
  return operation === "design_generation" ? CREDIT_COSTS.designGeneration : CREDIT_COSTS.editorAi;
}

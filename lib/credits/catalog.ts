export const CREDIT_COSTS = {
  designGeneration: 10,
  editorAi: 1,
} as const;

export const CREDIT_PLANS = [
  { id: "starter", name: "Starter", price: 14_900, credits: 30, recommended: false },
  { id: "standard", name: "Standard", price: 29_900, credits: 80, recommended: true },
  { id: "studio", name: "Studio", price: 59_000, credits: 200, recommended: false },
] as const;

export type CreditPlanId = (typeof CREDIT_PLANS)[number]["id"];
export type CreditOperation = "design_generation" | "editor_ai";

export function creditPlan(planId: string) {
  return CREDIT_PLANS.find((plan) => plan.id === planId) ?? null;
}
export function creditCost(operation: CreditOperation) {
  return operation === "design_generation" ? CREDIT_COSTS.designGeneration : CREDIT_COSTS.editorAi;
}

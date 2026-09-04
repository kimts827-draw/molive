import type { ReactNode } from "react";
import { CREDIT_COSTS, type CreditPlan } from "@/lib/credits/catalog";
import styles from "./plan-cards.module.css";

export type { CreditPlan };

/** plans는 항상 lib/growth/pricing-config에서 해석된 실험군 가격표다. */
export function PlanCards({ plans, action }: { plans: CreditPlan[]; action: (plan: CreditPlan) => ReactNode }) {
  return <div className={styles.priceGrid}>{plans.map((plan) => <article className={plan.recommended ? styles.priceRecommended : undefined} key={plan.id}>{plan.recommended ? <span>추천</span> : null}<small>{plan.name}</small><h3>{plan.price.toLocaleString("ko-KR")}원</h3><strong>{plan.credits} Credit</strong><div className={styles.planUsage}><b>쇼핑몰 디자인 생성 최대 {Math.floor(plan.credits / CREDIT_COSTS.designGeneration)}회</b><p>또는 AI 수정에 자유롭게 사용</p></div>{action(plan)}</article>)}</div>;
}

/**
 * 가격 실험 설정 파일. 가격을 바꾸거나 실험군을 추가할 때 이 파일 하나만 고치면 된다.
 *
 * 규칙
 * - 결제 페이지·랜딩·주문 생성은 전부 이 표에서 가격을 읽는다. 다른 곳에 가격 숫자를 적지 않는다.
 * - price_group은 가입 시 첫 유입 utm_campaign으로 한 번 배정되고 이후 고정된다.
 * - 매핑에 없는 campaign과 UTM 없이 들어온 방문자는 모두 DEFAULT_PRICE_GROUP을 본다.
 */

export const DEFAULT_PRICE_GROUP = "default";

/** 실험군별 가격표. credits는 크레딧 수이며 디자인 생성 1회는 10C다. */
export const PRICE_GROUPS = {
  default: {
    starter: { price: 14_900, credits: 30 },
    standard: { price: 29_900, credits: 80 },
    studio: { price: 59_000, credits: 200 },
  },

  // 나중에 추가할 실험군. 주석을 풀고 아래 CAMPAIGN_PRICE_GROUPS에 캠페인을 연결하면 바로 적용된다.
  // groupB: {
  //   starter: { price: 9_900, credits: 30 },
  //   standard: { price: 19_900, credits: 80 },
  //   studio: { price: 39_000, credits: 200 },
  // },
} as const satisfies Record<string, Record<PlanId, PlanPrice>>;

/**
 * utm_campaign -> price_group 매핑. 지금은 비어 있어 모두 default를 본다.
 * 예) "g1_premade": "groupB",
 */
export const CAMPAIGN_PRICE_GROUPS: Record<string, string> = {};

export type PlanId = "starter" | "standard" | "studio";
export type PlanPrice = { price: number; credits: number };

export const PLAN_IDS = ["starter", "standard", "studio"] as const satisfies readonly PlanId[];

const priceGroups = PRICE_GROUPS as unknown as Record<string, Record<PlanId, PlanPrice>>;

export function isKnownPriceGroup(group: string | null | undefined): boolean {
  return typeof group === "string" && group in priceGroups;
}

/** 배정된 그룹이 설정에서 사라져도 결제가 멈추지 않도록 default로 되돌린다. */
export function resolvePriceGroup(group: string | null | undefined): string {
  return isKnownPriceGroup(group) ? (group as string) : DEFAULT_PRICE_GROUP;
}

/** 가입 시 한 번 실행되는 배정 규칙. 캠페인이 없으면 default. */
export function priceGroupForCampaign(campaign: string | null | undefined): string {
  const mapped = campaign ? CAMPAIGN_PRICE_GROUPS[campaign] : undefined;
  return resolvePriceGroup(mapped);
}

export function priceTable(group: string | null | undefined): Record<PlanId, PlanPrice> {
  return priceGroups[resolvePriceGroup(group)];
}

export function planPrice(group: string | null | undefined, planId: PlanId): PlanPrice {
  return priceTable(group)[planId];
}

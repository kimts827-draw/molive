/**
 * 대시보드 표의 모양만 담는다. 브라우저 번들에 들어가도 안전하도록 여기에는
 * service_role 클라이언트를 절대 import하지 않는다. 집계 로직은 dashboard.ts에 있다.
 */

/** 유입 정보가 없는 방문·회원을 담는 칸. UTM 없이 들어온 경우도 집계에서 빠지지 않는다. */
export const DIRECT_BUCKET = "(direct)";

export type TodayCounter = { label: string; today: number; yesterday: number; delta: number };

export type FunnelRow = {
  campaign: string;
  visit: number;
  signup: number;
  generateStart: number;
  generateDone: number;
  checkoutView: number;
  purchase: number;
};

export type PriceGroupRow = {
  priceGroup: string;
  checkoutView: number;
  purchase: number;
  revenue: number;
  planBreakdown: { planName: string; count: number }[];
};

export type MemberRow = {
  userId: string;
  email: string;
  signedUpAt: string;
  utmCampaign: string | null;
  utmContent: string | null;
  priceGroup: string;
  generateCount: number;
  paid: boolean;
  paidAmount: number;
  lastActiveAt: string | null;
};

export type GrowthDashboard = {
  counters: TodayCounter[];
  funnel: FunnelRow[];
  priceGroups: PriceGroupRow[];
  members: MemberRow[];
  campaigns: string[];
  eventTotal: number;
  generatedAt: string;
};

export function conversionPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round((current / previous) * 1000) / 10;
}

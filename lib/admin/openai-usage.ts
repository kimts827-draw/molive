import "server-only";
import { OPENAI_USAGE_TYPES, type OpenAIUsageActorType, type OpenAIUsageType } from "@/lib/openai/usage-store";
import { createAdminClient } from "@/lib/supabase/admin";

export type OpenAIUsageSummary = {
  todayCostUsd: number;
  monthCostUsd: number;
  totalCostUsd: number;
  customerCostUsd: number;
  adminCostUsd: number;
  totalGenerations: number;
  averageCostUsd: number;
  highestCostUsd: number;
};

export type RecentOpenAIUsage = {
  generationId: string;
  usageType: OpenAIUsageType;
  actorType: OpenAIUsageActorType;
  userId: string;
  projectId: string | null;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  requestCount: number;
  imageCount: number;
  estimatedCostUsd: number;
  createdAt: string;
};

export type OpenAIUsageByFeature = {
  usageType: OpenAIUsageType;
  totalCostUsd: number;
  totalOperations: number;
  averageCostUsd: number;
};

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getAdminOpenAIUsage(): Promise<{ summary: OpenAIUsageSummary; byFeature: OpenAIUsageByFeature[]; recent: RecentOpenAIUsage[] }> {
  const admin = createAdminClient();
  const [summaryResult, featureResult, recentResult] = await Promise.all([
    admin.rpc("get_admin_openai_usage_summary", { p_timezone: "Asia/Seoul" }),
    admin.rpc("get_admin_openai_usage_by_feature"),
    admin.rpc("get_admin_recent_openai_usage", { p_limit: 30 }),
  ]);
  if (summaryResult.error) throw new Error(`OpenAI 사용량 요약 조회 실패: ${summaryResult.error.message}`);
  if (featureResult.error) throw new Error(`OpenAI 기능별 사용량 조회 실패: ${featureResult.error.message}`);
  if (recentResult.error) throw new Error(`최근 OpenAI 사용량 조회 실패: ${recentResult.error.message}`);

  const row = summaryResult.data?.[0] ?? {};
  const featureRows = new Map<string, Record<string, unknown>>((featureResult.data ?? []).map((item: Record<string, unknown>) => [String(item.usage_type), item]));
  return {
    summary: {
      todayCostUsd: numeric(row.today_cost_usd),
      monthCostUsd: numeric(row.month_cost_usd),
      totalCostUsd: numeric(row.total_cost_usd),
      customerCostUsd: numeric(row.customer_cost_usd),
      adminCostUsd: numeric(row.admin_cost_usd),
      totalGenerations: numeric(row.total_generations),
      averageCostUsd: numeric(row.average_cost_usd),
      highestCostUsd: numeric(row.highest_cost_usd),
    },
    byFeature: OPENAI_USAGE_TYPES.map((usageType) => {
      const item: Record<string, unknown> = featureRows.get(usageType) ?? {};
      return {
        usageType,
        totalCostUsd: numeric(item.total_cost_usd),
        totalOperations: numeric(item.total_operations),
        averageCostUsd: numeric(item.average_cost_usd),
      };
    }),
    recent: (recentResult.data ?? []).map((item: Record<string, unknown>) => ({
      generationId: String(item.generation_id),
      usageType: String(item.usage_type) as OpenAIUsageType,
      actorType: String(item.actor_type) as OpenAIUsageActorType,
      userId: String(item.user_id),
      projectId: item.project_id ? String(item.project_id) : null,
      model: String(item.model),
      inputTokens: numeric(item.input_tokens),
      cachedInputTokens: numeric(item.cached_input_tokens),
      outputTokens: numeric(item.output_tokens),
      requestCount: numeric(item.request_count),
      imageCount: numeric(item.image_count),
      estimatedCostUsd: numeric(item.estimated_cost_usd),
      createdAt: String(item.created_at),
    })),
  };
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type OpenAIUsageSummary = {
  todayCostUsd: number;
  monthCostUsd: number;
  totalGenerations: number;
  averageCostUsd: number;
  highestCostUsd: number;
};

export type RecentOpenAIUsage = {
  generationId: string;
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

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getAdminOpenAIUsage(): Promise<{ summary: OpenAIUsageSummary; recent: RecentOpenAIUsage[] }> {
  const admin = createAdminClient();
  const [summaryResult, recentResult] = await Promise.all([
    admin.rpc("get_admin_openai_usage_summary", { p_timezone: "Asia/Seoul" }),
    admin.rpc("get_admin_recent_openai_usage", { p_limit: 30 }),
  ]);
  if (summaryResult.error) throw new Error(`OpenAI 사용량 요약 조회 실패: ${summaryResult.error.message}`);
  if (recentResult.error) throw new Error(`최근 OpenAI 사용량 조회 실패: ${recentResult.error.message}`);

  const row = summaryResult.data?.[0] ?? {};
  return {
    summary: {
      todayCostUsd: numeric(row.today_cost_usd),
      monthCostUsd: numeric(row.month_cost_usd),
      totalGenerations: numeric(row.total_generations),
      averageCostUsd: numeric(row.average_cost_usd),
      highestCostUsd: numeric(row.highest_cost_usd),
    },
    recent: (recentResult.data ?? []).map((item: Record<string, unknown>) => ({
      generationId: String(item.generation_id),
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

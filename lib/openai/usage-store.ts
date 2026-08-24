import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OpenAIUsageEvent } from "@/lib/openai/usage";

export function createGenerationUsageRecorder(input: { generationId: string; userId: string }) {
  return async (event: OpenAIUsageEvent) => {
    const { error } = await createAdminClient().from("openai_usage_events").insert({
      generation_id: input.generationId,
      user_id: input.userId,
      model: event.model,
      input_tokens: event.inputTokens,
      cached_input_tokens: event.cachedInputTokens,
      cache_write_input_tokens: event.cacheWriteInputTokens,
      output_tokens: event.outputTokens,
      request_count: event.requestCount,
      image_count: event.imageCount,
      image_cost_usd: event.imageCostUsd,
      estimated_cost_usd: event.estimatedCostUsd,
      pricing_version: event.pricingVersion,
    });
    if (error) throw new Error(`OpenAI 사용량 저장 실패: ${error.message}`);
  };
}

export async function attachGenerationUsageToProject(input: { generationId: string; userId: string; projectId: string }) {
  const { error } = await createAdminClient()
    .from("openai_usage_events")
    .update({ project_id: input.projectId })
    .eq("generation_id", input.generationId)
    .eq("user_id", input.userId);
  if (error) throw new Error(`OpenAI 사용량 프로젝트 연결 실패: ${error.message}`);
}

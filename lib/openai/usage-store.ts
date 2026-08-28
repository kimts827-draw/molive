import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OpenAIUsageEvent } from "@/lib/openai/usage";
import type { OpenAIUsageActorType } from "@/lib/auth/roles";

export const OPENAI_USAGE_TYPES = ["design_generation", "editor_ai", "preview_image"] as const;
export type OpenAIUsageType = (typeof OPENAI_USAGE_TYPES)[number];
export type { OpenAIUsageActorType } from "@/lib/auth/roles";

export function createGenerationUsageRecorder(input: { generationId: string; userId: string; actorType: OpenAIUsageActorType; usageType: OpenAIUsageType; projectId?: string | null }) {
  return async (event: OpenAIUsageEvent) => {
    const { error } = await createAdminClient().from("openai_usage_events").insert({
      generation_id: input.generationId,
      user_id: input.userId,
      actor_type: input.actorType,
      project_id: input.projectId ?? null,
      usage_type: input.usageType,
      model: event.model,
      input_tokens: event.inputTokens,
      cached_input_tokens: event.cachedInputTokens,
      cache_write_input_tokens: event.cacheWriteInputTokens,
      output_tokens: event.outputTokens,
      request_count: event.requestCount,
      image_count: event.imageCount,
      text_input_tokens: event.textInputTokens,
      cached_text_input_tokens: event.cachedTextInputTokens,
      image_input_tokens: event.imageInputTokens,
      cached_image_input_tokens: event.cachedImageInputTokens,
      image_output_tokens: event.imageOutputTokens,
      // Legacy DB column name; the value is a usage-token pricing estimate.
      image_cost_usd: event.estimatedImageCostUsd,
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

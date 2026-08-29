import "server-only";
import OpenAI from "openai";
import { composeFallbackPagePlan } from "@/lib/design-library/plan-composer";
import { normalizePagePlan, pagePlanJsonSchema, pagePlanSchema, type PagePlan } from "@/lib/design-library/page-plan";
import { buildPagePlanUserPrompt, PAGE_PLAN_SYSTEM_PROMPT, type PagePlanInput } from "@/lib/openai/page-plan-contract";
import { usageEventFromResponse, type OpenAIUsageEvent } from "@/lib/openai/usage";
import { OpenAIUsageRecordingError, runRecordedOpenAICall } from "@/lib/openai/recorded-call";

export type { PagePlanInput };
export type PagePlanResult = { plan: PagePlan; source: "ai" | "fallback"; error?: string };

function planModel() {
  return process.env.OPENAI_PLAN_MODEL || process.env.OPENAI_MODEL || "gpt-5.6";
}

/**
 * 1단계: AI가 이번 몰의 본문 구성을 설계합니다.
 * 어떤 이유로든 실패하면 업종 가중치 기반 결정적 조합기로 물러나며,
 * 그 대비 경로도 고정 템플릿이 아니라 브리프마다 다른 구성을 만듭니다.
 */
export async function generatePagePlan(input: PagePlanInput, options?: { onUsage?: (event: OpenAIUsageEvent) => Promise<void> }): Promise<PagePlanResult> {
  if (!process.env.OPENAI_API_KEY || process.env.PAGE_PLAN_GENERATION === "off") {
    return { plan: composeFallbackPagePlan(input, input.seed), source: "fallback", error: "page planner disabled" };
  }
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const requestedModel = planModel();
    const response = await runRecordedOpenAICall({
      onUsage: options?.onUsage,
      call: () => client.responses.create({
        model: requestedModel,
        store: false,
        max_output_tokens: 6000,
        input: [
          { role: "system", content: PAGE_PLAN_SYSTEM_PROMPT },
          { role: "user", content: buildPagePlanUserPrompt(input) },
        ],
        text: { format: { type: "json_schema", name: "moire_page_plan", strict: true, schema: pagePlanJsonSchema } },
      }),
      usageFromResponse: usageEventFromResponse,
      usageFromError: (usage) => usage ? usageEventFromResponse({ model: requestedModel, usage: usage as Parameters<typeof usageEventFromResponse>[0]["usage"] }) : null,
    });
    const parsed = pagePlanSchema.parse(JSON.parse(response.output_text));
    // 사용자가 고른 hex는 AI 응답을 심판하지 않고 코드가 그대로 확정합니다(재시도 없음).
    return { plan: normalizePagePlan(parsed, { brandColor: (input.colors ?? [])[0], brief: input.prompt }), source: "ai" };
  } catch (error) {
    if (error instanceof OpenAIUsageRecordingError) throw error;
    const message = error instanceof Error ? error.message : "unknown page plan error";
    console.error("Page plan 생성 실패, 결정적 조합기로 대체합니다", message);
    return { plan: composeFallbackPagePlan(input, input.seed), source: "fallback", error: message };
  }
}

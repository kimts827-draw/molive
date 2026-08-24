export const openAIPricingVersion = "openai-2026-08-21";

type TokenRates = {
  input: number;
  cachedInput: number;
  cacheWriteInput: number;
  output: number;
};

const tokenRatesPerMillion: Array<{ matches: (model: string) => boolean; rates: TokenRates }> = [
  { matches: (model) => model === "gpt-5.6" || model.startsWith("gpt-5.6-sol"), rates: { input: 4, cachedInput: 0.4, cacheWriteInput: 5, output: 20 } },
  { matches: (model) => model.startsWith("gpt-5.6-terra"), rates: { input: 2, cachedInput: 0.2, cacheWriteInput: 2.5, output: 12 } },
  { matches: (model) => model.startsWith("gpt-5.6-luna"), rates: { input: 0.2, cachedInput: 0.02, cacheWriteInput: 0.25, output: 1.2 } },
  { matches: (model) => model.startsWith("gpt-5.5"), rates: { input: 5, cachedInput: 0.5, cacheWriteInput: 5, output: 30 } },
  { matches: (model) => model.startsWith("gpt-5.4-mini"), rates: { input: 0.75, cachedInput: 0.075, cacheWriteInput: 0.75, output: 4.5 } },
  { matches: (model) => model.startsWith("gpt-5.4-nano"), rates: { input: 0.2, cachedInput: 0.02, cacheWriteInput: 0.2, output: 1.25 } },
  { matches: (model) => model.startsWith("gpt-5.4"), rates: { input: 2.5, cachedInput: 0.25, cacheWriteInput: 2.5, output: 15 } },
];

type ResponseUsageLike = {
  input_tokens?: number;
  input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number } | null;
  output_tokens?: number;
} | null;

export type OpenAIUsageEvent = {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  requestCount: 1;
  imageCount: number;
  imageCostUsd: number;
  estimatedCostUsd: number;
  pricingVersion: string;
};

function tokenCount(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value ?? 0)) : 0;
}

export function estimateTextCostUsd(input: {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
}) {
  const rates = tokenRatesPerMillion.find((entry) => entry.matches(input.model))?.rates;
  if (!rates) return 0;
  const cached = Math.min(input.inputTokens, input.cachedInputTokens);
  const cacheWrite = Math.min(input.inputTokens - cached, input.cacheWriteInputTokens);
  const uncached = Math.max(0, input.inputTokens - cached - cacheWrite);
  return (
    uncached * rates.input
    + cached * rates.cachedInput
    + cacheWrite * rates.cacheWriteInput
    + input.outputTokens * rates.output
  ) / 1_000_000;
}

type ImageUsageLike = { input_tokens?: number; output_tokens?: number } | null | undefined;

/**
 * 이미지 모델 단가는 계정 계약에 따라 달라지므로 표에 가정값을 넣지 않고
 * OPENAI_IMAGE_PRICE_USD로 받은 장당 단가만 씁니다. 값이 없으면 토큰 비용처럼 0으로 둡니다.
 */
function imagePricePerImageUsd() {
  const configured = Number(process.env.OPENAI_IMAGE_PRICE_USD);
  return Number.isFinite(configured) && configured > 0 ? configured : 0;
}

/** 이미지 생성 1회를 사용량 이벤트로 기록합니다. */
export function usageEventFromImageResponse(input: { model: string; usage?: ImageUsageLike; imageCount: number }): OpenAIUsageEvent {
  const imageCount = Math.max(0, Math.trunc(input.imageCount));
  const imageCostUsd = imageCount * imagePricePerImageUsd();
  return {
    model: input.model,
    inputTokens: tokenCount(input.usage?.input_tokens),
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    outputTokens: tokenCount(input.usage?.output_tokens),
    requestCount: 1,
    imageCount,
    imageCostUsd,
    estimatedCostUsd: imageCostUsd,
    pricingVersion: openAIPricingVersion,
  };
}

export function usageEventFromResponse(response: { model: string; usage?: ResponseUsageLike }): OpenAIUsageEvent {
  const inputTokens = tokenCount(response.usage?.input_tokens);
  const cachedInputTokens = Math.min(inputTokens, tokenCount(response.usage?.input_tokens_details?.cached_tokens));
  const cacheWriteInputTokens = Math.min(inputTokens - cachedInputTokens, tokenCount(response.usage?.input_tokens_details?.cache_write_tokens));
  const outputTokens = tokenCount(response.usage?.output_tokens);
  const estimatedCostUsd = estimateTextCostUsd({ model: response.model, inputTokens, cachedInputTokens, cacheWriteInputTokens, outputTokens });
  return {
    model: response.model,
    inputTokens,
    cachedInputTokens,
    cacheWriteInputTokens,
    outputTokens,
    requestCount: 1,
    imageCount: 0,
    imageCostUsd: 0,
    estimatedCostUsd,
    pricingVersion: openAIPricingVersion,
  };
}

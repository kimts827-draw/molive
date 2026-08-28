export const openAIPricingVersion = "openai-2026-08-28";

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

type ImageTokenRates = {
  textInput: number;
  cachedTextInput: number;
  imageInput: number;
  cachedImageInput: number;
  imageOutput: number;
};

const imageTokenRatesPerMillion: Array<{ matches: (model: string) => boolean; rates: ImageTokenRates }> = [
  {
    matches: (model) => model === "gpt-image-2" || model.startsWith("gpt-image-2-"),
    rates: { textInput: 5, cachedTextInput: 1.25, imageInput: 8, cachedImageInput: 2, imageOutput: 30 },
  },
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
  textInputTokens: number;
  cachedTextInputTokens: number;
  imageInputTokens: number;
  cachedImageInputTokens: number;
  imageOutputTokens: number;
  estimatedImageCostUsd: number;
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

type ImageUsageLike = {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: {
    text_tokens?: number;
    image_tokens?: number;
    cached_tokens?: number;
    cached_text_tokens?: number;
    cached_image_tokens?: number;
  } | null;
  output_tokens_details?: { text_tokens?: number; image_tokens?: number } | null;
} | null | undefined;

export function estimateImageCostUsd(input: {
  model: string;
  textInputTokens: number;
  cachedTextInputTokens: number;
  imageInputTokens: number;
  cachedImageInputTokens: number;
  imageOutputTokens: number;
}) {
  const rates = imageTokenRatesPerMillion.find((entry) => entry.matches(input.model))?.rates;
  if (!rates) return 0;
  const cachedText = Math.min(input.textInputTokens, input.cachedTextInputTokens);
  const cachedImage = Math.min(input.imageInputTokens, input.cachedImageInputTokens);
  return (
    (input.textInputTokens - cachedText) * rates.textInput
    + cachedText * rates.cachedTextInput
    + (input.imageInputTokens - cachedImage) * rates.imageInput
    + cachedImage * rates.cachedImageInput
    + input.imageOutputTokens * rates.imageOutput
  ) / 1_000_000;
}

/** 이미지 생성 1회를 사용량 이벤트로 기록합니다. */
export function usageEventFromImageResponse(input: { model: string; usage?: ImageUsageLike; imageCount: number }): OpenAIUsageEvent {
  const imageCount = Math.max(0, Math.trunc(input.imageCount));
  const inputTokens = tokenCount(input.usage?.input_tokens);
  const outputTokens = tokenCount(input.usage?.output_tokens);
  const details = input.usage?.input_tokens_details;
  const detailedTextInput = tokenCount(details?.text_tokens);
  const detailedImageInput = tokenCount(details?.image_tokens);
  const hasInputBreakdown = detailedTextInput + detailedImageInput > 0;
  const textInputTokens = hasInputBreakdown ? detailedTextInput : inputTokens;
  const imageInputTokens = hasInputBreakdown ? detailedImageInput : 0;
  const explicitCachedText = tokenCount(details?.cached_text_tokens);
  const explicitCachedImage = tokenCount(details?.cached_image_tokens);
  const cachedTotal = Math.min(inputTokens, tokenCount(details?.cached_tokens) || explicitCachedText + explicitCachedImage);
  const remainingCached = Math.max(0, cachedTotal - explicitCachedText - explicitCachedImage);
  // The Images API currently reports modality totals. If it supplies only an aggregate
  // cached count, a text-only generation can still be classified exactly.
  const cachedTextInputTokens = Math.min(textInputTokens, explicitCachedText + (imageInputTokens === 0 ? remainingCached : 0));
  const cachedImageInputTokens = Math.min(imageInputTokens, explicitCachedImage + (textInputTokens === 0 ? remainingCached : 0));
  const imageOutputTokens = tokenCount(input.usage?.output_tokens_details?.image_tokens) || outputTokens;
  const estimatedImageCostUsd = estimateImageCostUsd({
    model: input.model,
    textInputTokens,
    cachedTextInputTokens,
    imageInputTokens,
    cachedImageInputTokens,
    imageOutputTokens,
  });
  return {
    model: input.model,
    inputTokens,
    cachedInputTokens: cachedTextInputTokens + cachedImageInputTokens,
    cacheWriteInputTokens: 0,
    outputTokens,
    requestCount: 1,
    imageCount,
    textInputTokens,
    cachedTextInputTokens,
    imageInputTokens,
    cachedImageInputTokens,
    imageOutputTokens,
    estimatedImageCostUsd,
    estimatedCostUsd: estimatedImageCostUsd,
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
    textInputTokens: inputTokens,
    cachedTextInputTokens: cachedInputTokens,
    imageInputTokens: 0,
    cachedImageInputTokens: 0,
    imageOutputTokens: 0,
    estimatedImageCostUsd: 0,
    estimatedCostUsd,
    pricingVersion: openAIPricingVersion,
  };
}

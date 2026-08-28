import "server-only";
import OpenAI from "openai";
import { buildPreviewImagePrompt, buildSectionImagePrompt, type GeneratedPreviewPhoto, type PreviewImageBrief } from "@/lib/openai/preview-image-contract";
import { usageEventFromImageResponse, type OpenAIUsageEvent } from "@/lib/openai/usage";
import { OpenAIUsageRecordingError, runRecordedOpenAICall } from "@/lib/openai/recorded-call";

/** 이번 생성에서 방금 만들어진 이미지 한 장의 원본입니다. */
export type GeneratedImageBytes = { index: number; kind: "product" | "section"; data: Buffer; contentType: string };

/** 만들어진 사진을 이번 세션 자산으로 확정해 주소를 돌려주는 sink입니다. */
export type GeneratedImageStore = (image: GeneratedImageBytes) => Promise<string | null>;

const PRODUCT_IMAGE_SIZE = "1024x1024" as const;
const SECTION_IMAGE_SIZE = "1536x1024" as const;
const IMAGE_OUTPUT_FORMAT = "webp" as const;
const DEFAULT_TIMEOUT_MS = 90_000;

function imageModel() {
  return process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
}

/** Preview 사진 생성을 끌 수 있는 스위치입니다. 끄면 SVG 자리표시자만 씁니다. */
export function previewImageGenerationEnabled() {
  return Boolean(process.env.OPENAI_API_KEY) && process.env.PREVIEW_PRODUCT_IMAGES !== "off";
}

function timeoutMs() {
  const configured = Number(process.env.PREVIEW_PRODUCT_IMAGE_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

async function generateImage(
  client: OpenAI,
  request: { index: number; kind: GeneratedImageBytes["kind"]; prompt: string; size: typeof PRODUCT_IMAGE_SIZE | typeof SECTION_IMAGE_SIZE },
  onUsage?: (event: OpenAIUsageEvent) => Promise<void>,
): Promise<GeneratedImageBytes | null> {
  const requestedModel = imageModel();
  const response = await runRecordedOpenAICall({
    onUsage,
    call: () => client.images.generate({
      model: requestedModel,
      prompt: request.prompt,
      n: 1,
      size: request.size,
      output_format: IMAGE_OUTPUT_FORMAT,
      output_compression: 70,
      background: "opaque",
    }, { signal: AbortSignal.timeout(timeoutMs()) }),
    usageFromResponse: (value) => usageEventFromImageResponse({ model: requestedModel, usage: value.usage, imageCount: 1 }),
    usageFromError: (usage) => usage ? usageEventFromImageResponse({ model: requestedModel, usage: usage as Parameters<typeof usageEventFromImageResponse>[0]["usage"], imageCount: 1 }) : null,
  });

  const encoded = response.data?.[0]?.b64_json;
  if (!encoded) return null;
  return { index: request.index, kind: request.kind, data: Buffer.from(encoded, "base64"), contentType: `image/${IMAGE_OUTPUT_FORMAT}` };
}

/**
 * 깨진 일반 섹션 이미지 한 자리를 대신할 사진을 만들어 이번 세션 자산으로 저장합니다.
 * 자리마다 1회만 시도하고, 실패하면 null을 돌려주어 호출자가 안전한 fallback으로 마감하게 합니다.
 */
export async function regenerateSectionImage(input: {
  request: { index: number; label?: string };
  brief: PreviewImageBrief;
  store: GeneratedImageStore;
  onUsage?: (event: OpenAIUsageEvent) => Promise<void>;
}): Promise<string | null> {
  if (!previewImageGenerationEnabled()) return null;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const image = await generateImage(
    client,
    { index: input.request.index, kind: "section", prompt: buildSectionImagePrompt(input.request.label, input.brief), size: SECTION_IMAGE_SIZE },
    input.onUsage,
  );
  return image ? input.store(image) : null;
}

/**
 * 이번 생성의 업종/컨셉에 맞는 Preview 상품 사진을 만듭니다.
 * 한 장이라도 실패하면 그 자리만 null로 돌려주고, 호출자는 SVG 자리표시자를 유지합니다.
 * 생성이 통째로 실패해도 절대 예외를 던지지 않습니다. Preview 사진 때문에 디자인 생성이 깨지면 안 됩니다.
 */
export async function generatePreviewProductPhotos(input: {
  targets: readonly { index: number; name: string }[];
  brief: PreviewImageBrief;
  store: GeneratedImageStore;
  onUsage?: (event: OpenAIUsageEvent) => Promise<void>;
}): Promise<GeneratedPreviewPhoto[]> {
  if (!input.targets.length || !previewImageGenerationEnabled()) return [];
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const settled = await Promise.allSettled(input.targets.map(async (target) => {
    const image = await generateImage(client, { index: target.index, kind: "product", prompt: buildPreviewImagePrompt(target.name, input.brief), size: PRODUCT_IMAGE_SIZE }, input.onUsage);
    if (!image) return null;
    const url = await input.store(image);
    return url ? { index: target.index, url } : null;
  }));

  const photos: GeneratedPreviewPhoto[] = [];
  for (const [position, result] of settled.entries()) {
    if (result.status === "fulfilled") {
      if (result.value) photos.push(result.value);
      continue;
    }
    const reason = result.reason;
    if (reason instanceof OpenAIUsageRecordingError) throw reason;
    console.error(
      `Preview 상품 사진 생성 실패 (${input.targets[position]?.name ?? "unknown"})`,
      reason instanceof Error ? reason.message : "unknown error",
    );
  }
  return photos;
}

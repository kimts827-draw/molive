import "server-only";
import type { OpenAIUsageEvent } from "@/lib/openai/usage";

type UsageRecorder = (event: OpenAIUsageEvent) => Promise<void>;

export class OpenAIUsageRecordingError extends Error {
  constructor(cause: unknown) {
    super("OpenAI usage를 저장하지 못했습니다.", { cause });
    this.name = "OpenAIUsageRecordingError";
  }
}

async function persistUsage(recorder: UsageRecorder, event: OpenAIUsageEvent) {
  try {
    await recorder(event);
  } catch (error) {
    throw new OpenAIUsageRecordingError(error);
  }
}

function usageFromThrownValue<T>(error: unknown, normalize: (value: unknown) => T | null): T | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { usage?: unknown; response?: { usage?: unknown }; error?: { usage?: unknown } };
  return normalize(candidate.usage ?? candidate.response?.usage ?? candidate.error?.usage);
}

export async function runRecordedOpenAICall<T>(input: {
  call: () => Promise<T>;
  onUsage?: UsageRecorder;
  usageFromResponse: (response: T) => OpenAIUsageEvent;
  usageFromError?: (usage: unknown) => OpenAIUsageEvent | null;
}) {
  if (!input.onUsage && process.env.NODE_ENV === "production") {
    throw new Error("Production OpenAI 호출에는 usage recorder가 필요합니다.");
  }
  try {
    const response = await input.call();
    if (input.onUsage) await persistUsage(input.onUsage, input.usageFromResponse(response));
    return response;
  } catch (error) {
    if (input.onUsage && input.usageFromError) {
      const event = usageFromThrownValue(error, input.usageFromError);
      if (event) await persistUsage(input.onUsage, event);
    }
    throw error;
  }
}

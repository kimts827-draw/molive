import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type GenerationTrace = {
  traceId: string;
  kind: "generate" | "edit";
  createdAt: string;
  request: unknown;
  response?: unknown;
  generated?: unknown;
  validator?: unknown;
  previewProductImages?: unknown;
  generalImageVerification?: unknown;
  /** plan 축을 어떤 근거로 DOM에 이었는지. fallback 의존도를 관측합니다. */
  planAttributeMapping?: unknown;
  /** 브랜드 색이 실제로 어디에 얼마나 쓰였는지. 검증이 아니라 관측 지표입니다. */
  brandColorUsage?: unknown;
  error?: string;
};

export async function writeGenerationTrace(trace: GenerationTrace) {
  if (process.env.NODE_ENV === "production") return;
  const directory = path.join(process.cwd(), ".moire", "traces");
  await mkdir(directory, { recursive: true });
  const safeTimestamp = trace.createdAt.replaceAll(":", "-");
  await writeFile(path.join(directory, `${safeTimestamp}-${trace.traceId}.json`), JSON.stringify(trace, null, 2), "utf8");
}

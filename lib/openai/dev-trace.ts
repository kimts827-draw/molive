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
  error?: string;
};

export async function writeGenerationTrace(trace: GenerationTrace) {
  if (process.env.NODE_ENV === "production") return;
  const directory = path.join(process.cwd(), ".moire", "traces");
  await mkdir(directory, { recursive: true });
  const safeTimestamp = trace.createdAt.replaceAll(":", "-");
  await writeFile(path.join(directory, `${safeTimestamp}-${trace.traceId}.json`), JSON.stringify(trace, null, 2), "utf8");
}

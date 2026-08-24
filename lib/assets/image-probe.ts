import "server-only";
import type { ImageProbe, ImageProbeResult } from "@/lib/assets/image-verification";

const DEFAULT_TIMEOUT_MS = 8_000;

function timeoutMs() {
  const configured = Number(process.env.IMAGE_VERIFY_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

/**
 * 이미지 주소가 실제로 응답하는지 확인합니다.
 * HEAD를 막아 둔 CDN이 있어 1바이트 Range GET으로 확인하고, 응답 본문은 읽지 않습니다.
 * 이미지가 아닌 content-type이면 img 태그에서 깨지므로 실패로 봅니다.
 */
export function createImageProbe(): ImageProbe {
  return async (url: string): Promise<ImageProbeResult> => {
    const response = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0", Accept: "image/*,*/*;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs()),
    });
    await response.body?.cancel();
    if (response.status < 200 || response.status >= 400) return { ok: false, httpStatus: response.status };
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    // 이미지가 아닌 응답은 재시도해도 같으므로 확정 실패입니다. img 태그에서 반드시 깨집니다.
    if (contentType && !contentType.startsWith("image/")) return { ok: false, httpStatus: response.status, error: `content-type: ${contentType}`, definitive: true };
    return { ok: true, httpStatus: response.status };
  };
}

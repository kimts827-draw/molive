/**
 * 브라우저에서 API 응답을 읽습니다.
 *
 * 라우트 코드가 실행되기 전에 플랫폼이 끊는 응답(413 Request Entity Too Large, 502 등)은
 * JSON이 아니라 평문/HTML입니다. 그대로 response.json()에 넘기면 사용자에게
 * "Unexpected token ..." 같은 파서 오류가 노출되므로 여기서 안전하게 걸러냅니다.
 */

function statusMessage(status: number, fallback: string) {
  if (status === 401) return "로그인이 필요합니다.";
  if (status === 403) return "권한이 없습니다.";
  if (status === 413) return "파일이 너무 커서 전송하지 못했습니다.";
  if (status === 415) return "지원하지 않는 파일 형식입니다.";
  return fallback;
}

export async function readJsonOrThrow<T>(response: Response, fallback: string): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  const error = (payload as { error?: unknown } | null)?.error;
  if (!response.ok) throw new Error(typeof error === "string" ? error : statusMessage(response.status, fallback));
  if (payload === null) throw new Error(fallback);
  return payload as T;
}

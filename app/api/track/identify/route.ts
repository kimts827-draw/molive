import { z } from "zod";
import { normalizeAttributionPayload } from "@/lib/growth/attribution";
import { identifySignup } from "@/lib/growth/identify";
import { hasSupabaseServerConfig } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

const schema = z.object({
  sessionId: z.string().min(1).max(100).nullable().optional(),
  attribution: z.unknown().optional(),
});

/**
 * 가입 직후 호출된다. 브라우저의 first-touch UTM을 프로필로 옮기고,
 * 같은 session_id의 이전 방문 기록에 user_id를 소급 연결한다.
 * 여러 번 호출돼도 안전하므로 클라이언트가 재시도해도 중복 기록이 생기지 않는다.
 */
export async function POST(request: Request) {
  if (!hasSupabaseServerConfig()) {
    return Response.json({ ok: false, error: "tracking_disabled" }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  let parsed: z.infer<typeof schema>;
  try {
    parsed = schema.parse(await request.json());
  } catch {
    return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  try {
    const result = await identifySignup({
      userId: user.id,
      sessionId: parsed.sessionId ?? null,
      attribution: normalizeAttributionPayload(parsed.attribution),
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[growth] identify 실패:", error instanceof Error ? error.message : error);
    return Response.json({ ok: false, error: "identify_failed" }, { status: 500 });
  }
}

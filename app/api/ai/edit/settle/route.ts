import { z } from "zod";
import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServerConfig } from "@/lib/supabase/config";
import { getCreditBalance, settleAiCredits } from "@/lib/credits/service";

/**
 * AI 편집 Credit 정산 경로입니다.
 *
 * /api/ai/edit는 모델 호출이 성공해도 예약만 남기고 응답합니다.
 * Editor가 patch를 실제 문서에 반영하고 Preview 렌더까지 확인하면 applied로 확정하고,
 * 렌더 검증 실패·patch 적용 실패로 변경을 되돌렸으면 discarded로 예약을 풉니다.
 * 어느 쪽도 호출되지 못하면 예약은 30분 lease 만료로 회수되어 차감되지 않습니다.
 */
const requestSchema = z.object({
  reservationId: z.uuid(),
  projectId: z.uuid().nullable().optional(),
  outcome: z.enum(["applied", "discarded"]),
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    if (!hasSupabaseServerConfig()) return Response.json({ settled: "skipped", balance: null });
    const parsedInput = requestSchema.safeParse(await request.json());
    if (!parsedInput.success) return Response.json({ error: "Credit 정산 요청 형식이 올바르지 않습니다.", issues: parsedInput.error.issues }, { status: 400 });
    const { reservationId, outcome } = parsedInput.data;
    const projectId = parsedInput.data.projectId ?? null;
    if (projectId) {
      const { data: ownedProject, error } = await createAdminClient().from("projects").select("id").eq("id", projectId).eq("owner_id", user.id).maybeSingle();
      if (error) throw error;
      if (!ownedProject) return Response.json({ error: "프로젝트에 접근할 수 없습니다." }, { status: 403 });
    }
    try {
      const balance = await settleAiCredits({ reservationId, userId: user.id, projectId, outcome });
      return Response.json({ settled: outcome, balance });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      // 이미 정산된 예약을 다시 부르는 것은 오류가 아닙니다. 현재 잔액만 돌려주고 끝냅니다.
      if (message.includes("CREDIT_RESERVATION_RELEASED") || message.includes("CREDIT_RESERVATION_NOT_FOUND")) {
        return Response.json({ settled: "already", balance: (await getCreditBalance(user.id)).balance });
      }
      throw error;
    }
  } catch (error) { return errorResponse(error); }
}

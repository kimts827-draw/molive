import { z } from "zod";
import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { editProjectNode } from "@/lib/openai/site-generator";
import { projectPagePlan } from "@/lib/project-source";
import { createGenerationUsageRecorder } from "@/lib/openai/usage-store";
import { openAIUsageActorType } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServerConfig } from "@/lib/supabase/config";
import { releaseAiCredits, reserveAiCredits } from "@/lib/credits/service";
import { NEW_SECTION_PRESET_IDS } from "@/lib/editor/new-section";
import { createImageProbe } from "@/lib/assets/image-probe";
import { HEADER_NODE_ID } from "@/lib/commerce/fixed-components";

const requestSchema = z.object({
  prompt: z.string().min(2).max(3000),
  nodeId: z.string().min(1).max(500),
  nodeType: z.string().min(1).max(200),
  nodeHtml: z.string().min(10).max(400000),
  projectCss: z.string().max(600000),
  rootValue: z.string().min(1).max(500),
  architecture: z.object({ header: z.string(), hero: z.string(), sections: z.array(z.string()), productPresentation: z.string(), typography: z.string(), footer: z.string() }),
  // 저장된 page plan을 참고 컨텍스트로만 받습니다. 형식이 어긋나면 projectPagePlan()이 null로 떨어뜨리고
  // plan 없는 기존 프로젝트와 같은 경로로 처리하므로, 여기서 요청을 거절하지 않습니다.
  pagePlan: z.unknown().optional(),
  renderMetrics: z.object({ width: z.number().finite().nonnegative(), height: z.number().finite().nonnegative(), fontSize: z.number().finite().nonnegative(), lineHeight: z.number().finite().nonnegative(), letterSpacing: z.number().finite(), marginTop: z.number().finite(), marginBottom: z.number().finite(), paddingTop: z.number().finite(), paddingBottom: z.number().finite() }).optional(),
  projectId: z.uuid().nullable().optional(),
  /**
   * 어떤 AI 기능으로 들어온 요청인지 코드가 명시적으로 받습니다.
   * 프롬프트 문장을 정규식으로 추측하지 않아야 메뉴별로 계약과 검증을 다르게 걸 수 있습니다.
   */
  operation: z.enum(["node-edit", "new-section", "redesign-section"]).optional(),
  sectionPreset: z.enum(NEW_SECTION_PRESET_IDS).optional(),
  sectionBrief: z.string().max(2000).optional(),
  /** 섹션 작업이 재사용할 수 있는, 이미 이 프로젝트 안에 있는 이미지 주소입니다. */
  projectAssetUrls: z.array(z.string().max(2000)).max(60).optional(),
  /** 선택 영역 밖에서 이미 쓰이고 있는 편집 ID입니다. patch가 이 값을 가져오지 못하게 막습니다. */
  reservedNodeIds: z.array(z.string().max(500)).max(1000).optional(),
}).refine((value) => value.operation !== "new-section" || Boolean(value.sectionPreset), {
  message: "새 섹션 유형을 선택해 주세요.",
  path: ["sectionPreset"],
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    if (hasSupabaseServerConfig() && (user.id === "public-demo-user" || user.id === "local-development-user")) {
      return Response.json({ error: "AI 수정에는 로그인이 필요합니다." }, { status: 401 });
    }
    const parsedInput = requestSchema.safeParse(await request.json());
    if (!parsedInput.success) {
      const firstIssue = parsedInput.error.issues[0];
      const field = firstIssue?.path.join(".") || "요청";
      return Response.json({ error: `AI 수정 요청의 ${field} 값을 확인해 주세요.`, issues: parsedInput.error.issues }, { status: 400 });
    }
    /**
     * 재디자인 대상은 상품 슬롯이 없는 본문 section뿐입니다.
     * 검증된 ProductSectionV1과 고정 HeaderV1은 코드가 소유하므로 Credit을 예약하기 전에 거절합니다.
     */
    if (parsedInput.data.operation === "redesign-section") {
      const { nodeId, nodeHtml } = parsedInput.data;
      if (nodeId === HEADER_NODE_ID) return Response.json({ error: "헤더는 고정 컴포넌트가 소유해서 다시 디자인할 수 없습니다. 형식은 Inspector에서 바꿀 수 있습니다." }, { status: 400 });
      if (/data-cafe24-slot/i.test(nodeHtml)) return Response.json({ error: "상품 진열 영역은 Cafe24 상품 바인딩이 소유해서 다시 디자인할 수 없습니다. 상품 영역을 감싸는 제목과 배경은 수정할 수 있습니다." }, { status: 400 });
      if (!/^\s*<section[\s>]/i.test(nodeHtml)) return Response.json({ error: "다시 디자인할 섹션을 찾지 못했습니다. 캔버스에서 섹션을 선택해 주세요." }, { status: 400 });
    }
    const projectId = parsedInput.data.projectId ?? null;
    if (projectId && hasSupabaseServerConfig()) {
      const { data: ownedProject, error } = await createAdminClient().from("projects").select("id").eq("id", projectId).eq("owner_id", user.id).maybeSingle();
      if (error) throw error;
      if (!ownedProject) return Response.json({ error: "프로젝트에 접근할 수 없습니다." }, { status: 403 });
    }
    let creditReservation: Awaited<ReturnType<typeof reserveAiCredits>> | null = null;
    /**
     * 예약을 클라이언트 정산(POST /api/ai/edit/settle)으로 넘겼는지 표시합니다.
     * 모델 호출이 성공해도 Editor가 실제로 문서에 반영하기 전에는 확정하지 않습니다.
     * 여기서 바로 commit하면 렌더 검증 실패로 변경이 롤백돼도 Credit만 사라집니다.
     */
    let creditDeferred = false;
    try {
      if (hasSupabaseServerConfig()) creditReservation = await reserveAiCredits(user.id, "editor_ai", projectId);
      const actorType = openAIUsageActorType("app_metadata" in user ? user.app_metadata as Record<string, unknown> : null);
      const onUsage = hasSupabaseServerConfig() ? createGenerationUsageRecorder({ generationId: crypto.randomUUID(), userId: user.id, actorType, projectId, usageType: "editor_ai" }) : undefined;
      const result = await editProjectNode({ ...parsedInput.data, pagePlan: projectPagePlan(parsedInput.data) ?? undefined }, { onUsage, imageProbe: createImageProbe() });
      creditDeferred = Boolean(creditReservation);
      return Response.json({
        ...result,
        // 반영이 확정될 때까지 잔액은 예약분을 뺀 사용 가능액으로만 보여 줍니다.
        balance: creditReservation ? creditReservation.available : null,
        credit: creditReservation ? { reservationId: creditReservation.id, amount: creditReservation.amount, status: "reserved" as const } : null,
      });
    } catch (error) {
      if (error instanceof z.ZodError) return Response.json({ error: "AI 수정 결과를 선택 영역 patch로 변환하지 못했습니다. 다시 시도해 주세요." }, { status: 422 });
      throw error;
    } finally {
      if (creditReservation && !creditDeferred) {
        try { await releaseAiCredits(creditReservation.id, user.id); }
        catch (releaseError) { console.error("Credit reservation release failed", releaseError instanceof Error ? releaseError.message : "unknown error"); }
      }
    }
  } catch (error) { return errorResponse(error); }
}

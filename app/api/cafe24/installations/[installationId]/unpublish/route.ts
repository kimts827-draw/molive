import { z } from "zod";
import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { cafe24Fetch } from "@/lib/cafe24/client";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ installationId: string }> }) {
  try {
    const user = await requireApiUser(request);
    const { installationId } = await params;
    z.uuid().parse(installationId);
    const admin = createAdminClient();
    const { data: installation } = await admin.from("cafe24_installations").select("id,project_id,connection_id,shop_no,script_no").eq("id", installationId).single();
    if (!installation) return Response.json({ error: "installation을 찾을 수 없습니다." }, { status: 404 });
    const { data: project } = await admin.from("projects").select("owner_id").eq("id", installation.project_id).eq("owner_id", user.id).single();
    if (!project) return Response.json({ error: "installation을 찾을 수 없습니다." }, { status: 404 });

    await admin.from("cafe24_installations").update({ status: "unpublished", updated_at: new Date().toISOString() }).eq("id", installationId);
    if (installation.script_no) {
      try {
        await cafe24Fetch(installation.connection_id, `/scripttags/${installation.script_no}?shop_no=${installation.shop_no}`, { method: "DELETE" });
        await admin.from("cafe24_installations").update({ script_no: null, last_error: null, updated_at: new Date().toISOString() }).eq("id", installationId);
      } catch (error) {
        await admin.from("cafe24_installations").update({ last_error: `ScriptTag 삭제 실패(런타임은 비활성): ${error instanceof Error ? error.message.slice(0, 420) : "unknown"}` }).eq("id", installationId);
      }
    }
    const { count } = await admin.from("cafe24_installations").select("id", { count: "exact", head: true }).eq("project_id", installation.project_id).eq("status", "active");
    if (!count) await admin.from("projects").update({ status: "ready", updated_at: new Date().toISOString() }).eq("id", installation.project_id).eq("owner_id", user.id);
    return Response.json({ status: "unpublished", originalStorefrontRestored: true });
  } catch (error) { return errorResponse(error); }
}

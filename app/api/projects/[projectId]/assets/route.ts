import { z } from "zod";
import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { isProjectAssetPath } from "@/lib/assets/asset-policy";
import { assertProjectOwner } from "@/lib/projects/service";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ storagePath: z.string().min(1).max(500), kind: z.enum(["logo", "product", "reference", "generated"]).default("reference") });

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireApiUser(request);
    const { projectId } = await params;
    z.uuid().parse(projectId);
    await assertProjectOwner(projectId, user.id);
    const input = schema.parse(await request.json());
    // 자산은 이 프로젝트 폴더 안에 있을 때만 연결합니다. 다른 프로젝트 경로는 연결 자체를 막습니다.
    if (!isProjectAssetPath(input.storagePath, user.id, projectId)) return Response.json({ error: "이 프로젝트에 업로드한 이미지만 연결할 수 있습니다." }, { status: 403 });
    const { error } = await createAdminClient().from("project_assets").upsert({ project_id: projectId, owner_id: user.id, kind: input.kind, storage_path: input.storagePath, mime_type: "image/webp", metadata: { source: "editor-upload" } }, { onConflict: "project_id,storage_path" });
    if (error) throw error;
    return Response.json({ saved: true });
  } catch (error) { return errorResponse(error); }
}

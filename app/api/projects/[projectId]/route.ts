import { z } from "zod";
import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { isProjectSource } from "@/lib/project-source";
import { loadProject, saveDraft } from "@/lib/projects/service";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireApiUser(request);
    const { projectId } = await params;
    z.uuid().parse(projectId);
    return Response.json(await loadProject(projectId, user.id));
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireApiUser(request);
    const { projectId } = await params;
    z.uuid().parse(projectId);
    const body = await request.json() as { source?: unknown };
    if (!isProjectSource(body.source)) return Response.json({ error: "Project Source 형식이 올바르지 않습니다." }, { status: 400 });
    await saveDraft(projectId, user.id, body.source);
    return Response.json({ saved: true });
  } catch (error) { return errorResponse(error); }
}

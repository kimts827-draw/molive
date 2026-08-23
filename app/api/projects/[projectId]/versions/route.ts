import { z } from "zod";
import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { isProjectSource } from "@/lib/project-source";
import { createVersion, loadProject } from "@/lib/projects/service";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireApiUser(request);
    const { projectId } = await params;
    z.uuid().parse(projectId);
    const project = await loadProject(projectId, user.id);
    return Response.json({ currentVersionId: project.currentVersionId, versions: project.versions });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireApiUser(request);
    const { projectId } = await params;
    z.uuid().parse(projectId);
    const body = await request.json() as { label?: unknown; source?: unknown };
    const label = z.string().min(1).max(120).parse(body.label);
    if (!isProjectSource(body.source)) return Response.json({ error: "Project Source 형식이 올바르지 않습니다." }, { status: 400 });
    const versionId = await createVersion(projectId, user.id, label, body.source);
    return Response.json({ versionId, createdAt: new Date().toISOString() });
  } catch (error) { return errorResponse(error); }
}

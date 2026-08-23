import { z } from "zod";
import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { activateVersion } from "@/lib/projects/service";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string; versionId: string }> }) {
  try {
    const user = await requireApiUser(request);
    const { projectId, versionId } = await params;
    z.uuid().parse(projectId);
    z.uuid().parse(versionId);
    const source = await activateVersion(projectId, user.id, versionId);
    return Response.json({ activeVersionId: versionId, source });
  } catch (error) { return errorResponse(error); }
}

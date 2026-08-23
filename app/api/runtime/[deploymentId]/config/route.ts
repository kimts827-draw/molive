import { createAdminClient } from "@/lib/supabase/admin";
import { isProjectSource } from "@/lib/project-source";
import { prepareProjectPatch } from "@/lib/cafe24/protection";

export async function GET(_request: Request, { params }: { params: Promise<{ deploymentId: string }> }) {
  const { deploymentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(deploymentId)) return Response.json({ error: "not found" }, { status: 404 });
  try {
    const admin = createAdminClient();
    const { data: installation } = await admin.from("cafe24_installations").select("project_id,status").eq("id", deploymentId).eq("status", "active").single();
    if (!installation) return Response.json({ error: "inactive" }, { status: 404 });
    const { data: project } = await admin.from("projects").select("current_version_id").eq("id", installation.project_id).single();
    if (!project?.current_version_id) return Response.json({ error: "invalid active version" }, { status: 404 });
    const { data: version } = await admin.from("site_versions").select("source_snapshot").eq("id", project.current_version_id).eq("project_id", installation.project_id).single();
    if (!version || !isProjectSource(version.source_snapshot)) return Response.json({ error: "invalid active version" }, { status: 404 });
    const payload = prepareProjectPatch(version.source_snapshot);
    return Response.json({ ...payload, activeVersionId: project.current_version_id }, { headers: { "Cache-Control": "no-store, max-age=0", "Access-Control-Allow-Origin": "*" } });
  } catch { return Response.json({ error: "inactive" }, { status: 404 }); }
}

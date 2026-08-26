import { EditorShell } from "@/components/editor/editor-shell";
import { demoProject } from "@/lib/demo-project";
import { getCurrentUser } from "@/lib/supabase/server";
import { hasSupabaseServerConfig, loadProject } from "@/lib/projects/service";
import { redirect } from "next/navigation";
import { getCreditBalance } from "@/lib/credits/service";
import "./editor.css";

export default async function EditorPage({ searchParams }: PageProps<"/editor">) {
  const query = await searchParams;
  const projectId = typeof query.project === "string" ? query.project : null;
  if (!projectId) return <EditorShell initialSource={demoProject} />;
  if (!hasSupabaseServerConfig()) return <EditorShell initialSource={demoProject} />;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/editor?project=${projectId}`)}`);
  const [project, credit] = await Promise.all([loadProject(projectId, user.id), getCreditBalance(user.id)]);
  return <EditorShell initialSource={project.source} projectId={project.id} initialVersions={project.versions} currentVersionId={project.currentVersionId} initialCreditBalance={credit.available} />;
}

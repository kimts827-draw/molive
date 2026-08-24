import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { didUpdateProject } from "@/lib/projects/persistence";
import { isProjectSource, type ProjectSource } from "@/lib/project-source";
export { hasSupabaseServerConfig } from "@/lib/supabase/config";

export type StoredVersion = {
  id: string;
  label: string;
  createdAt: string;
  source: ProjectSource;
};

export async function assertProjectOwner(projectId: string, ownerId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("projects")
    .select("id,owner_id,name,current_document,current_version_id,status")
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .single();
  if (error || !data) throw new Error("프로젝트를 찾을 수 없습니다.");
  return data;
}

export async function listProjects(ownerId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("projects")
    .select("id,name,status,current_version_id,updated_at")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((project) => ({
    id: String(project.id),
    name: String(project.name),
    status: String(project.status),
    currentVersionId: project.current_version_id ? String(project.current_version_id) : null,
    updatedAt: String(project.updated_at),
  }));
}

export async function createProjectWithVersion(ownerId: string, source: ProjectSource, brandBrief: Record<string, unknown>) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_project_with_version", {
    p_owner_id: ownerId,
    p_name: source.name,
    p_brand_brief: brandBrief,
    p_source: source,
    p_label: "초기 생성",
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row?.project_id || !row?.version_id) throw error ?? new Error("프로젝트를 저장하지 못했습니다.");
  return { projectId: String(row.project_id), versionId: String(row.version_id) };
}

export async function loadProject(projectId: string, ownerId: string) {
  const project = await assertProjectOwner(projectId, ownerId);
  const admin = createAdminClient();
  const { data: versionRows, error } = await admin
    .from("site_versions")
    .select("id,label,created_at,source_snapshot")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const source = isProjectSource(project.current_document) ? project.current_document : null;
  if (!source) throw new Error("저장된 Project Source가 올바르지 않습니다.");
  const versions: StoredVersion[] = (versionRows ?? []).flatMap((row) => isProjectSource(row.source_snapshot) ? [{
    id: String(row.id),
    label: String(row.label),
    createdAt: String(row.created_at),
    source: row.source_snapshot,
  }] : []);
  return {
    id: String(project.id),
    name: String(project.name),
    status: String(project.status),
    currentVersionId: project.current_version_id ? String(project.current_version_id) : null,
    source,
    versions,
  };
}

export async function saveDraft(projectId: string, ownerId: string, source: ProjectSource) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("projects")
    .update({ current_document: source, name: source.name, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return didUpdateProject(data);
}

export async function createVersion(projectId: string, ownerId: string, label: string, source: ProjectSource) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_site_version_and_activate", {
    p_project_id: projectId,
    p_owner_id: ownerId,
    p_label: label,
    p_source: source,
  });
  if (error || !data) throw error ?? new Error("버전을 저장하지 못했습니다.");
  return String(data);
}

export async function activateVersion(projectId: string, ownerId: string, versionId: string) {
  const admin = createAdminClient();
  await assertProjectOwner(projectId, ownerId);
  const { data: version, error } = await admin
    .from("site_versions")
    .select("id,source_snapshot")
    .eq("id", versionId)
    .eq("project_id", projectId)
    .single();
  if (error || !version || !isProjectSource(version.source_snapshot)) throw new Error("복원할 버전을 찾을 수 없습니다.");
  const { error: updateError } = await admin
    .from("projects")
    .update({ current_version_id: versionId, current_document: version.source_snapshot, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("owner_id", ownerId);
  if (updateError) throw updateError;
  return version.source_snapshot;
}

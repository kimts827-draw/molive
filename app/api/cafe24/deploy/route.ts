import { z } from "zod";
import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { cafe24Fetch } from "@/lib/cafe24/client";
import { injectManagedPresentation, inlinePresentationStyles, prepareProjectPatch, validateThemeMutation } from "@/lib/cafe24/protection";
import { resolveExportVersion } from "@/lib/projects/service";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ projectId: z.uuid(), connectionId: z.uuid(), skinNo: z.number().int().positive(), mode: z.enum(["runtime", "theme"]).default("runtime") });
const runtimeLoaderRevision = "explicit-js-path-v3";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const input = schema.parse(await request.json());
    const admin = createAdminClient();
    // 게시도 Editor의 현재 문서를 씁니다. 버전이 뒤처져 있으면 승격한 뒤 그 버전으로 배포합니다.
    const activeVersion = await resolveExportVersion(input.projectId, user.id);
    const patch = prepareProjectPatch(activeVersion.source);
    const { data: connection } = await admin.from("cafe24_connections").select("id,user_id,mall_id,shop_no").eq("id", input.connectionId).eq("user_id", user.id).single();
    if (!connection) return Response.json({ error: "Cafe24 연결을 찾을 수 없습니다." }, { status: 404 });

    if (input.mode === "runtime") {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!appUrl?.startsWith("https://")) throw new Error("Runtime 배포에는 HTTPS NEXT_PUBLIC_APP_URL이 필요합니다.");
      const { data: installation, error: installationError } = await admin.from("cafe24_installations").upsert({
        project_id: input.projectId,
        connection_id: input.connectionId,
        shop_no: connection.shop_no,
        skin_no: input.skinNo,
        status: "installing",
        last_error: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "connection_id,shop_no,skin_no" }).select("id,script_no,status").single();
      if (installationError || !installation) throw installationError ?? new Error("Cafe24 installation을 만들지 못했습니다.");

      let scriptNo = installation.script_no ? String(installation.script_no) : null;
      const loaderSrc = `${appUrl}/api/runtime/${installation.id}/loader.js?v=${runtimeLoaderRevision}`;
      try {
        if (!scriptNo) {
          const response = await cafe24Fetch(input.connectionId, "/scripttags", {
            method: "POST",
            body: JSON.stringify({ shop_no: connection.shop_no, request: { src: loaderSrc, display_location: ["all"] } }),
          });
          const result = await response.json() as { scripttag?: { script_no?: number | string } };
          if (result.scripttag?.script_no === undefined) throw new Error("Cafe24가 ScriptTag 번호를 반환하지 않았습니다.");
          scriptNo = String(result.scripttag.script_no);
        } else {
          await cafe24Fetch(input.connectionId, `/scripttags/${scriptNo}`, {
            method: "PUT",
            body: JSON.stringify({ shop_no: connection.shop_no, request: { src: loaderSrc, display_location: ["all"] } }),
          });
        }
      } catch (error) {
        await admin.from("cafe24_installations").update({ status: "error", last_error: error instanceof Error ? error.message.slice(0, 500) : "ScriptTag 설치 실패", updated_at: new Date().toISOString() }).eq("id", installation.id);
        throw error;
      }

      const deployedAt = new Date().toISOString();
      const { error: activateError } = await admin.from("cafe24_installations").update({ status: "active", script_no: scriptNo, installed_at: deployedAt, last_error: null, updated_at: deployedAt }).eq("id", installation.id);
      if (activateError) throw activateError;
      await admin.from("projects").update({ status: "published", updated_at: deployedAt }).eq("id", input.projectId).eq("owner_id", user.id);
      const { data: deployment, error: deploymentError } = await admin.from("deployments").insert({ project_id: input.projectId, connection_id: input.connectionId, installation_id: installation.id, version_id: activeVersion.versionId, mode: "runtime", skin_no: input.skinNo, status: "active", external_id: scriptNo, payload: { projectSourceId: activeVersion.source.id }, created_by: user.id, deployed_at: deployedAt }).select("id").single();
      if (deploymentError) throw deploymentError;
      return Response.json({ deploymentId: deployment.id, installationId: installation.id, scriptNo, reusedScriptTag: Boolean(installation.script_no), activeVersionId: activeVersion.versionId, mode: "runtime", status: "active" });
    }

    if (process.env.CAFE24_THEME_WRITE_ENABLED !== "true") return Response.json({ error: "Theme Pages 쓰기는 Cafe24의 별도 클라이언트 승인이 필요합니다. Runtime 모드를 사용하세요." }, { status: 409 });
    const originalResponse = await cafe24Fetch(input.connectionId, `/themes/${input.skinNo}/pages?path=${encodeURIComponent("index.html")}`);
    const originalPayload = await originalResponse.json();
    const original = originalPayload?.theme?.source ?? originalPayload?.source;
    if (typeof original !== "string") throw new Error("Cafe24 index.html 원본을 읽지 못했습니다.");
    const nextSource = injectManagedPresentation(original, inlinePresentationStyles(patch.html, patch.css));
    const report = validateThemeMutation("index.html", original, nextSource);
    if (!report.safe) return Response.json({ error: "Cafe24 보호 검사에 실패했습니다.", report }, { status: 422 });
    await cafe24Fetch(input.connectionId, `/themes/${input.skinNo}/pages`, { method: "PUT", body: JSON.stringify({ request: { path: "index.html", source: nextSource } }) });
    const { data: deployment, error: deploymentError } = await admin.from("deployments").insert({ project_id: input.projectId, connection_id: input.connectionId, version_id: activeVersion.versionId, mode: "theme", skin_no: input.skinNo, status: "active", payload: { projectSourceId: activeVersion.source.id }, created_by: user.id, deployed_at: new Date().toISOString() }).select("id").single();
    if (deploymentError) throw deploymentError;
    return Response.json({ deploymentId: deployment.id, activeVersionId: activeVersion.versionId, mode: "theme", status: "active", report });
  } catch (error) { return errorResponse(error); }
}

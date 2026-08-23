import { z } from "zod";
import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { collectAssetUrls } from "@/lib/cafe24/theme-assets";
import { buildThemeEntries, collectBaseSkin, fetchThemeAssets, THEME_BASE_DIR } from "@/lib/cafe24/theme-package";
import { loadProject } from "@/lib/projects/service";
import { createZip } from "@/lib/zip";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const projectId = z.uuid().parse(new URL(request.url).searchParams.get("project_id"));
    const project = await loadProject(projectId, user.id);
    if (!project.currentVersionId) return Response.json({ error: "내려받을 activeVersion이 없습니다. 먼저 버전을 저장하세요." }, { status: 409 });
    const activeVersion = project.versions.find((version) => version.id === project.currentVersionId);
    if (!activeVersion) return Response.json({ error: "activeVersion의 Project Source를 찾을 수 없습니다." }, { status: 409 });

    const base = await collectBaseSkin(THEME_BASE_DIR);
    const assets = await fetchThemeAssets(collectAssetUrls(activeVersion.source.html, activeVersion.source.css));
    const built = buildThemeEntries(base, activeVersion.source, assets);
    const zip = createZip(built.entries);
    const name = `moire-skin-${project.id.slice(0, 8)}-${activeVersion.id.slice(0, 8)}.zip`;
    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(zip.length),
        "Cache-Control": "no-store, max-age=0",
        "X-Moire-Files": String(built.entries.length),
        "X-Moire-Product-Slots": `${built.slotsFilled}/${built.productModules}`,
        "X-Moire-Product-Adapter": `${built.slotsAdapted}/${built.slotsFilled}`,
        "X-Moire-Shared-Header": built.headerShared ? built.headerBindings.join(",") || "home-only" : "cafe24",
        "X-Moire-Header-Sub-Pages": built.headerOnSubPages ? "moire" : "cafe24",
        "X-Moire-Footer": built.footerRemoved ? "cafe24-only" : "cafe24",
        "X-Moire-Global-Theme": built.globalTheme ? "on" : "off",
        "X-Moire-Assets": `${built.assetsEmbedded}/${assets.mapping.size + assets.failed.length}`,
        "X-Moire-Skipped": String(built.skipped.length),
      },
    });
  } catch (error) { return errorResponse(error); }
}

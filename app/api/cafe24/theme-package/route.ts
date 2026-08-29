import { z } from "zod";
import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { collectAssetUrls } from "@/lib/cafe24/theme-assets";
import { buildThemeEntries, collectBaseSkin, fetchThemeAssets, THEME_BASE_DIR } from "@/lib/cafe24/theme-package";
import { resolveExportVersion } from "@/lib/projects/service";
import { createZip } from "@/lib/zip";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const projectId = z.uuid().parse(new URL(request.url).searchParams.get("project_id"));
    // Editor의 현재 문서를 그대로 내보냅니다. 버전이 뒤처져 있으면 여기서 승격됩니다.
    const activeVersion = await resolveExportVersion(projectId, user.id);

    const base = await collectBaseSkin(THEME_BASE_DIR);
    const logoImage = "headerPresentation" in activeVersion.source ? activeVersion.source.headerPresentation?.logo.imageUrl ?? "" : "";
    const assets = await fetchThemeAssets(collectAssetUrls(activeVersion.source.html, activeVersion.source.css, logoImage ? `<img src="${logoImage}">` : ""));
    const built = buildThemeEntries(base, activeVersion.source, assets);
    const zip = createZip(built.entries);
    const name = `molive-skin-${projectId.slice(0, 8)}-${activeVersion.versionId.slice(0, 8)}.zip`;
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
        "X-Moire-Version": activeVersion.versionId,
        "X-Moire-Version-Promoted": activeVersion.createdVersion ? "current-document" : "unchanged",
      },
    });
  } catch (error) { return errorResponse(error); }
}

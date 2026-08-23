import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { buildPocFiles } from "@/lib/cafe24/poc/theme-poc";
import { collectBaseSkin, THEME_BASE_DIR } from "@/lib/cafe24/theme-package";
import { isServerManagedSkinFile } from "@/lib/cafe24/theme-template";
import { createZip, type ZipEntry } from "@/lib/zip";

export async function GET(request: Request) {
  try {
    await requireApiUser(request);
    const base = await collectBaseSkin(THEME_BASE_DIR);
    const files = new Map<string, Buffer>(base);
    const poc = buildPocFiles(base);
    for (const [path, data] of poc) files.set(path, data);

    const entries: ZipEntry[] = [...files]
      .filter(([path]) => !isServerManagedSkinFile(path))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, data]) => ({ path, data }));
    const zip = createZip(entries);
    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="moire-cafe24-poc.zip"',
        "Content-Length": String(zip.length),
        "Cache-Control": "no-store, max-age=0",
        "X-Moire-Poc": "header-v1,product-grid-v1",
        "X-Moire-Files": String(entries.length),
        "X-Moire-Poc-Overrides": [...poc.keys()].sort().join(","),
      },
    });
  } catch (error) { return errorResponse(error); }
}

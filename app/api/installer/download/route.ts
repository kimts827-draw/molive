import { getInstallerDownloadUrl } from "@/lib/installer-release";

export const dynamic = "force-dynamic";

export function GET() {
  const downloadUrl = getInstallerDownloadUrl();

  if (!downloadUrl) {
    return new Response("Installer 다운로드가 아직 준비되지 않았습니다.", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  return Response.redirect(downloadUrl, 307);
}

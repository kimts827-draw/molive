import { z } from "zod";
import { buildEditorPreviewDocument } from "@/lib/editor/preview-document";
import { loadProject } from "@/lib/projects/service";
import { getCurrentUser } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!z.uuid().safeParse(projectId).success) return new Response(null, { status: 404 });

  const user = await getCurrentUser();
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `/preview/${projectId}`);
    return Response.redirect(loginUrl, 307);
  }

  try {
    const project = await loadProject(projectId, user.id);
    const preview = buildEditorPreviewDocument(project.source);
    return new Response(preview.srcDoc, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Type": "text/html; charset=utf-8",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

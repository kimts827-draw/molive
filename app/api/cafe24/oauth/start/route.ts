import { cookies } from "next/headers";
import { cafe24AuthorizationUrl, createOAuthState, normalizeMallId } from "@/lib/cafe24/oauth";
import { errorResponse } from "@/lib/api/auth";
import { requireApiUser } from "@/lib/api/auth";
import { assertProjectOwner } from "@/lib/projects/service";
import { z } from "zod";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const url = new URL(request.url);
    const mallId = normalizeMallId(url.searchParams.get("mall_id") ?? "");
    const projectId = z.uuid().parse(url.searchParams.get("project_id"));
    await assertProjectOwner(projectId, user.id);
    const state = createOAuthState(mallId, user.id, projectId);
    const cookieStore = await cookies();
    cookieStore.set("c24_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
    return Response.redirect(cafe24AuthorizationUrl(mallId, state));
  } catch (error) { return errorResponse(error); }
}

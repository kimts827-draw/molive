import { cookies } from "next/headers";
import { exchangeAuthorizationCode, verifyOAuthState } from "@/lib/cafe24/oauth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/security/encryption";

export async function GET(request: Request) {
  const redirect = new URL("/editor", request.url);
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    const cookieStore = await cookies();
    const storedState = cookieStore.get("c24_oauth_state")?.value;
    cookieStore.delete("c24_oauth_state");
    if (!code || !returnedState || !storedState || returnedState !== storedState) throw new Error("Cafe24 OAuth state 검증에 실패했습니다.");
    const state = verifyOAuthState(returnedState);
    const user = await getCurrentUser();
    if (!user) throw new Error("Cafe24 연결을 저장하려면 먼저 로그인해야 합니다.");
    if (user.id !== state.userId) throw new Error("Cafe24 연결을 시작한 사용자와 현재 사용자가 다릅니다.");
    redirect.searchParams.set("project", state.projectId);
    const token = await exchangeAuthorizationCode(state.mallId, code);
    const admin = createAdminClient();
    const connectedAt = new Date().toISOString();
    const { data: connection, error: connectionError } = await admin.from("cafe24_connections").upsert({ user_id: user.id, mall_id: token.mall_id, shop_no: Number(token.shop_no), scopes: token.scopes, status: "connected", connected_at: connectedAt, updated_at: connectedAt }, { onConflict: "user_id,mall_id,shop_no" }).select("id").single();
    if (connectionError || !connection) throw connectionError ?? new Error("Cafe24 연결을 저장하지 못했습니다.");
    const { error: credentialError } = await admin.rpc("upsert_cafe24_credential", {
      p_connection_id: connection.id,
      p_mall_id: token.mall_id,
      p_access_token_encrypted: encryptSecret(token.access_token),
      p_refresh_token_encrypted: encryptSecret(token.refresh_token),
      p_expires_at: token.expires_at,
      p_refresh_token_expires_at: token.refresh_token_expires_at,
    });
    if (credentialError) throw credentialError;
    redirect.searchParams.set("cafe24", "connected");
  } catch (error) {
    redirect.searchParams.set("cafe24", "error");
    redirect.searchParams.set("message", error instanceof Error ? error.message.slice(0, 160) : "연결 실패");
  }
  return Response.redirect(redirect);
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";

type CredentialRow = { connection_id: string; mall_id: string; access_token_encrypted: string; refresh_token_encrypted: string; expires_at: string; refresh_token_expires_at: string };

function cafe24ExpiryMs(value: string) {
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}+09:00`).getTime();
}

async function refreshCredential(credential: CredentialRow) {
  const clientId = process.env.CAFE24_CLIENT_ID;
  const clientSecret = process.env.CAFE24_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Cafe24 앱 자격 증명이 없습니다.");
  const response = await fetch(`https://${credential.mall_id}.cafe24api.com/api/v2/oauth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: decryptSecret(credential.refresh_token_encrypted) }),
    cache: "no-store",
  });
  if (!response.ok) {
    const admin = createAdminClient();
    await admin.from("cafe24_connections").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", credential.connection_id);
    throw new Error(`Cafe24 토큰 갱신에 실패했습니다. 다시 연결해 주세요. (${response.status})`);
  }
  const token = await response.json() as { access_token: string; refresh_token: string; expires_at: string; refresh_token_expires_at: string };
  const admin = createAdminClient();
  const updated = {
    ...credential,
    access_token_encrypted: encryptSecret(token.access_token),
    refresh_token_encrypted: encryptSecret(token.refresh_token),
    expires_at: token.expires_at,
    refresh_token_expires_at: token.refresh_token_expires_at,
  };
  const { error } = await admin.rpc("upsert_cafe24_credential", {
    p_connection_id: credential.connection_id,
    p_mall_id: credential.mall_id,
    p_access_token_encrypted: updated.access_token_encrypted,
    p_refresh_token_encrypted: updated.refresh_token_encrypted,
    p_expires_at: updated.expires_at,
    p_refresh_token_expires_at: updated.refresh_token_expires_at,
  });
  if (error) throw error;
  return updated;
}

export async function cafe24Fetch(connectionId: string, path: string, init: RequestInit = {}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_cafe24_credential", { p_connection_id: connectionId });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) throw new Error("Cafe24 연결 자격 증명을 찾을 수 없습니다.");
  let credential = row as CredentialRow;
  const send = (current: CredentialRow) => fetch(`https://${current.mall_id}.cafe24api.com/api/v2/admin${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${decryptSecret(current.access_token_encrypted)}`,
      "Content-Type": "application/json",
      "X-Cafe24-Api-Version": process.env.CAFE24_API_VERSION || "2026-03-01",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (cafe24ExpiryMs(credential.expires_at) < Date.now() + 60_000) credential = await refreshCredential(credential);
  let response = await send(credential);
  if (response.status === 401) {
    credential = await refreshCredential(credential);
    response = await send(credential);
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Cafe24 API 오류 (${response.status}): ${detail.slice(0, 300)}`);
  }
  return response;
}

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

type OAuthState = { mallId: string; userId: string; projectId: string; nonce: string; exp: number };

export function normalizeMallId(value: string): string {
  const mallId = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_]{1,38}$/.test(mallId)) throw new Error("Cafe24 쇼핑몰 ID 형식이 올바르지 않습니다.");
  return mallId;
}

function stateSecret() {
  const secret = process.env.CAFE24_OAUTH_STATE_SECRET;
  if (!secret || secret.length < 32) throw new Error("CAFE24_OAUTH_STATE_SECRET를 32자 이상으로 설정하세요.");
  return secret;
}

function configuredRedirectUri() {
  const redirectUri = process.env.CAFE24_REDIRECT_URI;
  if (!redirectUri) throw new Error("CAFE24_REDIRECT_URI가 설정되지 않았습니다.");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production" && (!appUrl?.startsWith("https://") || redirectUri !== `${appUrl}/api/cafe24/oauth/callback`)) {
    throw new Error("CAFE24_REDIRECT_URI는 NEXT_PUBLIC_APP_URL의 OAuth callback HTTPS 주소와 정확히 일치해야 합니다.");
  }
  return redirectUri;
}

export function createOAuthState(mallId: string, userId: string, projectId: string): string {
  const payload: OAuthState = { mallId: normalizeMallId(mallId), userId, projectId, nonce: crypto.randomUUID(), exp: Date.now() + 10 * 60 * 1000 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", stateSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyOAuthState(token: string): OAuthState {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) throw new Error("OAuth state가 올바르지 않습니다.");
  const expected = createHmac("sha256", stateSecret()).update(encoded).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error("OAuth state 서명이 일치하지 않습니다.");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthState;
  if (payload.exp < Date.now()) throw new Error("OAuth 연결 요청이 만료되었습니다.");
  payload.mallId = normalizeMallId(payload.mallId);
  if (!/^[0-9a-f-]{36}$/i.test(payload.userId) || !/^[0-9a-f-]{36}$/i.test(payload.projectId)) throw new Error("OAuth 연결 대상이 올바르지 않습니다.");
  return payload;
}

export function cafe24AuthorizationUrl(mallId: string, state: string) {
  const clientId = process.env.CAFE24_CLIENT_ID;
  const redirectUri = configuredRedirectUri();
  if (!clientId) throw new Error("Cafe24 앱 환경 변수가 설정되지 않았습니다.");
  const url = new URL(`https://${normalizeMallId(mallId)}.cafe24api.com/api/v2/oauth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  const scopes = ["mall.read_application", "mall.write_application"];
  if (process.env.CAFE24_THEME_WRITE_ENABLED === "true") scopes.push("mall.read_design", "mall.write_design");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  return url;
}

export type Cafe24TokenResponse = {
  access_token: string;
  expires_at: string;
  refresh_token: string;
  refresh_token_expires_at: string;
  mall_id: string;
  user_id: string;
  scopes: string[];
  shop_no: string;
};

export async function exchangeAuthorizationCode(mallId: string, code: string): Promise<Cafe24TokenResponse> {
  const clientId = process.env.CAFE24_CLIENT_ID;
  const clientSecret = process.env.CAFE24_CLIENT_SECRET;
  const redirectUri = configuredRedirectUri();
  if (!clientId || !clientSecret) throw new Error("Cafe24 앱 환경 변수가 설정되지 않았습니다.");
  const response = await fetch(`https://${normalizeMallId(mallId)}.cafe24api.com/api/v2/oauth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Cafe24 토큰 발급에 실패했습니다. (${response.status})`);
  return response.json() as Promise<Cafe24TokenResponse>;
}

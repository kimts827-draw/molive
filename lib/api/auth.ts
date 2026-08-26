import "server-only";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/supabase/server";
import { InsufficientCreditsError } from "@/lib/credits/service";

export async function requireApiUser(request: Request) {
  if (process.env.NODE_ENV !== "production" && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { id: "local-development-user" };
  }
  if (process.env.AI_DEMO_PUBLIC === "true") {
    const origin = request.headers.get("origin");
    const expected = new URL(request.url).origin;
    if (origin === expected) return { id: "public-demo-user" };
  }
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "로그인이 필요합니다.");
  return user;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof InsufficientCreditsError) return Response.json({ error: error.message, code: "insufficient_credits", required: error.required, pricingUrl: "/pricing" }, { status: 402 });
  if (error instanceof ZodError) return Response.json({ error: "요청 데이터 형식이 올바르지 않습니다.", issues: error.issues }, { status: 400 });
  const message = process.env.NODE_ENV === "production" ? "요청을 처리하지 못했습니다." : error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
  return Response.json({ error: message }, { status: 500 });
}

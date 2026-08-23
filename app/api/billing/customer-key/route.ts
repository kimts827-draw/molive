import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { customerKeyForUser } from "@/lib/billing/toss";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    return Response.json({ customerKey: customerKeyForUser(user.id), clientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? null });
  } catch (error) { return errorResponse(error); }
}

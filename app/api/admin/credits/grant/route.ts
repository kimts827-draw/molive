import { z } from "zod";
import { errorResponse } from "@/lib/api/auth";
import { requireAdminApi } from "@/lib/admin/auth";
import { manualGrantCredits } from "@/lib/credits/service";

const schema = z.object({ userId: z.uuid(), amount: z.number().int().min(1).max(100_000), reason: z.string().trim().min(2).max(300) });

export async function POST(request: Request) {
  try {
    const admin = await requireAdminApi(request);
    const input = schema.parse(await request.json());
    const balance = await manualGrantCredits({ ...input, grantedBy: admin.id });
    return Response.json({ balance });
  } catch (error) { return errorResponse(error); }
}

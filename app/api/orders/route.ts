import { z } from "zod";
import { errorResponse, ApiError, requireApiUser } from "@/lib/api/auth";
import { bankTransferConfig } from "@/lib/credits/bank";
import { createBankTransferOrder } from "@/lib/credits/service";

const schema = z.object({
  planId: z.enum(["starter", "standard", "studio"]),
  depositorName: z.string().trim().min(1).max(80),
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    if (!bankTransferConfig().available) throw new ApiError(503, "입금 계좌 설정이 완료되지 않았습니다.");
    const input = schema.parse(await request.json());
    const order = await createBankTransferOrder(user.id, input.planId, input.depositorName);
    return Response.json({ order }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

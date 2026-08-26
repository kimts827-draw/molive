import { z } from "zod";
import { errorResponse } from "@/lib/api/auth";
import { requireAdminApi } from "@/lib/admin/auth";
import { fulfillCreditOrder } from "@/lib/credits/service";

export async function POST(request: Request, context: RouteContext<"/api/admin/orders/[orderId]/approve">) {
  try {
    const admin = await requireAdminApi(request);
    const orderId = z.uuid().parse((await context.params).orderId);
    const result = await fulfillCreditOrder(orderId, admin.id, "bank_transfer");
    return Response.json({ result });
  } catch (error) { return errorResponse(error); }
}

import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/auth";
import { errorResponse } from "@/lib/api/auth";
import { updateInquiryStatus } from "@/lib/inquiries/service";

const schema = z.object({ status: z.enum(["pending", "resolved"]) });

export async function PATCH(request: Request, context: { params: Promise<{ inquiryId: string }> }) {
  try {
    await requireAdminApi(request);
    const inquiryId = z.uuid().parse((await context.params).inquiryId);
    const { status } = schema.parse(await request.json());
    const inquiry = await updateInquiryStatus(inquiryId, status);
    return Response.json({ inquiry });
  } catch (error) {
    return errorResponse(error);
  }
}

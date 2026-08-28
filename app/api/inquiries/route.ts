import { z } from "zod";
import { errorResponse } from "@/lib/api/auth";
import { INQUIRY_CATEGORIES } from "@/lib/inquiries/config";
import { createClient } from "@/lib/supabase/server";

const categoryValues = INQUIRY_CATEGORIES.map(({ value }) => value) as [
  typeof INQUIRY_CATEGORIES[number]["value"],
  ...typeof INQUIRY_CATEGORIES[number]["value"][],
];

const inquirySchema = z.object({
  category: z.enum(categoryValues),
  email: z.string().trim().email().max(320),
  subject: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1).max(5000),
});

export async function POST(request: Request) {
  try {
    const input = inquirySchema.parse(await request.json());
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("inquiries").insert({
      user_id: user?.id ?? null,
      email: input.email,
      category: input.category,
      subject: input.subject,
      content: input.content,
    });
    if (error) throw error;
    return Response.json({ message: "문의가 접수되었습니다." }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

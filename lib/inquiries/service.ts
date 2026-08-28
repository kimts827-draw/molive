import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InquiryCategory, InquiryStatus } from "@/lib/inquiries/config";

export type Inquiry = {
  id: string;
  userId: string | null;
  email: string;
  category: InquiryCategory;
  subject: string;
  content: string;
  status: InquiryStatus;
  createdAt: string;
};

type InquiryRow = {
  id: string;
  user_id: string | null;
  email: string;
  category: InquiryCategory;
  subject: string;
  content: string;
  status: InquiryStatus;
  created_at: string;
};

function mapInquiry(row: InquiryRow): Inquiry {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    category: row.category,
    subject: row.subject,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function listAdminInquiries() {
  const { data, error } = await createAdminClient()
    .from("inquiries")
    .select("id,user_id,email,category,subject,content,status,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data as InquiryRow[]).map(mapInquiry);
}

export async function updateInquiryStatus(inquiryId: string, status: InquiryStatus) {
  const { data, error } = await createAdminClient()
    .from("inquiries")
    .update({ status })
    .eq("id", inquiryId)
    .select("id,user_id,email,category,subject,content,status,created_at")
    .single();
  if (error) throw error;
  return mapInquiry(data as InquiryRow);
}

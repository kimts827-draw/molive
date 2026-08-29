import "server-only";
import { templateCatalog } from "@/lib/templates/catalog";
import { RESOURCE_ADMIN_EMAIL } from "@/lib/auth/roles";
import type { ResourceBoardKey } from "./board.ts";
import type { ResourcePostInput } from "./schema.ts";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServerConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type ResourcePost = {
  id: string;
  board: ResourceBoardKey;
  title: string;
  summary: string;
  content: string;
  category: string;
  brandColor: string;
  prompt: string;
  imageUrl: string;
  authorEmail: string;
  createdAt: string;
  updatedAt: string;
};

type ResourcePostRow = {
  id: string;
  board: ResourceBoardKey;
  title: string;
  summary: string | null;
  content: string | null;
  category: string | null;
  brand_color: string | null;
  prompt: string | null;
  image_url: string | null;
  author_email: string;
  created_at: string;
  updated_at: string;
};

const COLUMNS = "id,board,title,summary,content,category,brand_color,prompt,image_url,author_email,created_at,updated_at";

function mapPost(row: ResourcePostRow): ResourcePost {
  return {
    id: row.id,
    board: row.board,
    title: row.title,
    summary: row.summary ?? "",
    content: row.content ?? "",
    category: row.category ?? "",
    brandColor: row.brand_color ?? "",
    prompt: row.prompt ?? "",
    imageUrl: row.image_url ?? "",
    authorEmail: row.author_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(board: ResourceBoardKey, input: ResourcePostInput) {
  const record = input as Partial<Record<string, string>>;
  return {
    board,
    title: record.title ?? "",
    summary: record.summary?.trim() ? record.summary.trim() : null,
    content: record.content?.trim() ? record.content.trim() : null,
    category: record.category?.trim() ? record.category.trim() : null,
    brand_color: record.brandColor?.trim() ? record.brandColor.trim().toUpperCase() : null,
    prompt: record.prompt?.trim() ? record.prompt.trim() : null,
    image_url: record.imageUrl?.trim() ? record.imageUrl.trim() : null,
  };
}

/**
 * Supabase가 설정되지 않은 개발/데모 환경에서만 사용하는 읽기 전용 시드.
 * 운영 데이터는 마이그레이션이 동일한 내용을 resource_posts에 넣는다.
 */
function fallbackPosts(board: ResourceBoardKey): ResourcePost[] {
  if (board !== "template") return [];
  return templateCatalog.map((template) => ({
    id: template.id,
    board: "template" as const,
    title: template.title,
    summary: template.mood,
    content: "",
    category: template.category,
    brandColor: template.brandColor,
    prompt: template.prompt,
    imageUrl: template.image.src,
    authorEmail: RESOURCE_ADMIN_EMAIL,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
  }));
}

export async function listResourcePosts(board: ResourceBoardKey): Promise<ResourcePost[]> {
  if (!hasSupabaseServerConfig()) return fallbackPosts(board);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resource_posts")
    .select(COLUMNS)
    .eq("board", board)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data as ResourcePostRow[]).map(mapPost);
}

export async function findResourcePost(board: ResourceBoardKey, postId: string): Promise<ResourcePost | null> {
  if (!hasSupabaseServerConfig()) return fallbackPosts(board).find((post) => post.id === postId) ?? null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resource_posts")
    .select(COLUMNS)
    .eq("board", board)
    .eq("id", postId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPost(data as ResourcePostRow) : null;
}

export async function createResourcePost(
  board: ResourceBoardKey,
  input: ResourcePostInput,
  author: { id: string; email: string },
): Promise<ResourcePost> {
  const { data, error } = await createAdminClient()
    .from("resource_posts")
    .insert({ ...toRow(board, input), author_id: author.id, author_email: author.email })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return mapPost(data as ResourcePostRow);
}

export async function updateResourcePost(
  board: ResourceBoardKey,
  postId: string,
  input: ResourcePostInput,
): Promise<ResourcePost | null> {
  const { data, error } = await createAdminClient()
    .from("resource_posts")
    .update({ ...toRow(board, input), updated_at: new Date().toISOString() })
    .eq("board", board)
    .eq("id", postId)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPost(data as ResourcePostRow) : null;
}

export async function deleteResourcePost(board: ResourceBoardKey, postId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("resource_posts")
    .delete()
    .eq("board", board)
    .eq("id", postId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

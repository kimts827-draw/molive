import { z } from "zod";
import { errorResponse, requireApiUser } from "@/lib/api/auth";
import { cafe24Fetch } from "@/lib/cafe24/client";
import { assertProjectOwner } from "@/lib/projects/service";
import { createAdminClient } from "@/lib/supabase/admin";

type InstallationRow = {
  id: string;
  project_id: string;
  connection_id: string;
  shop_no: number;
  skin_no: number;
  script_no: string | number | null;
  status: string;
  last_error: string | null;
  installed_at: string | null;
  updated_at: string;
};

async function verifyRemoteScriptTag(installation: InstallationRow) {
  if (!installation.script_no) return { state: "missing" as const };

  try {
    const response = await cafe24Fetch(
      installation.connection_id,
      `/scripttags/${installation.script_no}?shop_no=${installation.shop_no}`,
    );
    const payload = (await response.json()) as {
      scripttag?: {
        script_no?: string | number;
        src?: string;
        display_location?: string[];
        skin_no?: number[];
        exclude_path?: string[];
        integrity?: string;
      };
    };
    const tag = payload.scripttag;
    if (!tag) return { state: "invalid_response" as const };

    return {
      state: "installed" as const,
      scriptNo: tag.script_no ?? installation.script_no,
      src: tag.src ?? null,
      displayLocation: tag.display_location ?? [],
      skinNo: tag.skin_no ?? [],
      excludePath: tag.exclude_path ?? [],
      integrity: tag.integrity ?? null,
    };
  } catch (error) {
    return {
      state: "error" as const,
      error: error instanceof Error ? error.message.slice(0, 300) : "Cafe24 ScriptTag 조회 실패",
    };
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const projectId = z.uuid().parse(new URL(request.url).searchParams.get("project_id"));
    await assertProjectOwner(projectId, user.id);
    const admin = createAdminClient();
    const [{ data: connections, error: connectionError }, { data: installations, error: installationError }] = await Promise.all([
      admin.from("cafe24_connections").select("id,mall_id,shop_no,status,connected_at,updated_at").eq("user_id", user.id).order("connected_at", { ascending: false }),
      admin.from("cafe24_installations").select("id,project_id,connection_id,shop_no,skin_no,script_no,status,last_error,installed_at,updated_at").eq("project_id", projectId).order("updated_at", { ascending: false }),
    ]);
    if (connectionError) throw connectionError;
    if (installationError) throw installationError;
    const verifiedInstallations = await Promise.all(
      ((installations ?? []) as InstallationRow[]).map(async (installation) => ({
        ...installation,
        remote: await verifyRemoteScriptTag(installation),
      })),
    );
    return Response.json({ connections: connections ?? [], installations: verifiedInstallations });
  } catch (error) { return errorResponse(error); }
}

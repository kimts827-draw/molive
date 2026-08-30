import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { STOREFRONT_FONTS, storefrontFontAssetPath } from "./storefront-fonts.ts";

/** public에서 Preview가 제공하는 파일을 읽어 Cafe24 ZIP 경로와 같은 Map으로 만듭니다. */
export async function collectStorefrontFontAssets(publicDir = join(process.cwd(), "public")) {
  const entries = await Promise.all(STOREFRONT_FONTS.flatMap((font) => [
    ...font.files.map((file) => storefrontFontAssetPath(font.id, file.fileName)),
    storefrontFontAssetPath(font.id, "OFL.txt"),
  ]).map(async (path) => [path, await readFile(join(publicDir, path))] as const));
  return new Map<string, Buffer>(entries);
}

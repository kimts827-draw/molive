import { createHash } from "node:crypto";

export const THEME_ASSET_DIR = "SkinImg/moire";

/** Cafe24 스킨 안의 이미지는 몰 루트 기준 절대 경로로 참조합니다. */
export function themeAssetHref(fileName: string) {
  return `/${THEME_ASSET_DIR}/${fileName}`;
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp",
  "image/gif": "gif", "image/avif": "avif", "image/svg+xml": "svg",
};

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif", "svg"]);

/** src, srcset, CSS url()에서 내려받을 수 있는 원격 이미지 주소만 모읍니다. */
export function collectAssetUrls(...sources: string[]) {
  const urls = new Set<string>();
  const add = (raw: string) => {
    const value = raw.trim().replace(/^["']|["']$/g, "");
    if (/^https?:\/\//i.test(value)) urls.add(value);
    else if (value.startsWith("//")) urls.add(`https:${value}`);
  };
  for (const source of sources) {
    for (const match of source.matchAll(/\bsrc\s*=\s*"([^"]+)"/gi)) add(match[1]);
    for (const match of source.matchAll(/\bsrcset\s*=\s*"([^"]+)"/gi)) {
      for (const candidate of match[1].split(",")) add(candidate.trim().split(/\s+/)[0] ?? "");
    }
    for (const match of source.matchAll(/url\(\s*([^)]+?)\s*\)/gi)) add(match[1]);
  }
  return [...urls];
}

/** 원본 주소와 `//` 축약형을 모두 스킨 경로로 바꿉니다. */
export function rewriteAssetUrls(text: string, mapping: Map<string, string>) {
  let output = text;
  for (const [url, fileName] of mapping) {
    const href = themeAssetHref(fileName);
    output = output.split(url).join(href);
    output = output.split(url.replace(/^https:/i, "")).join(href);
  }
  return output;
}

export function assetFileName(url: string, contentType: string | null) {
  const fromType = contentType ? EXTENSION_BY_TYPE[contentType.split(";")[0]?.trim().toLowerCase() ?? ""] : undefined;
  let extension = fromType;
  if (!extension) {
    try {
      const candidate = new URL(url).pathname.split(".").pop()?.toLowerCase();
      if (candidate && ALLOWED_EXTENSIONS.has(candidate)) extension = candidate === "jpeg" ? "jpg" : candidate;
    } catch { extension = undefined; }
  }
  if (!extension) return null;
  return `${createHash("sha1").update(url).digest("hex").slice(0, 12)}.${extension}`;
}

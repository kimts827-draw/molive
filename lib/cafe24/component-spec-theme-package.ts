import { renderProject } from "../component-library/index.ts";
import type { ProjectSpecV1 } from "../project-document.ts";
import type { ZipEntry } from "../zip.ts";
import { rewriteAssetUrls } from "./theme-assets.ts";
import { resolveFooterInk } from "./theme-bridge.ts";
import {
  BASE_LAYOUT_PATH,
  INDEX_PATH,
  POC_CSS_PATH,
  POC_HEADER_PATH,
  POC_LAYOUT_PATH,
  buildPocLayout,
} from "./poc/theme-poc.ts";
import { isServerManagedSkinFile } from "./theme-template.ts";
import { buildStorefrontFontFaceCss } from "../fonts/storefront-fonts.ts";

type PackagedAssets = {
  files: Map<string, Buffer>;
  mapping: Map<string, string>;
};

function documentBody(documentHtml: string, headerHtml: string) {
  const prefix = `${headerHtml}\n`;
  if (!documentHtml.startsWith(prefix)) {
    throw new Error("RenderBundle.documentHtml이 RenderBundle.headerHtml로 시작하지 않습니다.");
  }
  return documentHtml.slice(prefix.length);
}

export function buildComponentSpecThemeEntries(
  base: Map<string, Buffer>,
  spec: ProjectSpecV1,
  assets?: PackagedAssets,
) {
  const baseLayout = base.get(BASE_LAYOUT_PATH);
  if (!baseLayout) throw new Error(`기준 스킨에 ${BASE_LAYOUT_PATH}이 없습니다.`);

  // 이 분기에서는 composeCommerce, marker adapter, Guide product module fallback을 사용하지 않습니다.
  const bundle = renderProject(spec, "cafe24");
  const mapping = assets?.mapping ?? new Map<string, string>();
  const documentHtml = rewriteAssetUrls(bundle.documentHtml, mapping);
  const headerHtml = rewriteAssetUrls(bundle.headerHtml, mapping);
  const css = `${buildStorefrontFontFaceCss("cafe24")}\n${rewriteAssetUrls(bundle.css, mapping)}`;
  const bodyHtml = documentBody(documentHtml, headerHtml);

  const files = new Map<string, Buffer>(base);
  for (const [path, data] of assets?.files ?? []) files.set(path, data);
  files.set(INDEX_PATH, Buffer.from(`<!--@layout(/${POC_LAYOUT_PATH})-->\n${bodyHtml}`, "utf8"));
  files.set(POC_HEADER_PATH, Buffer.from(headerHtml, "utf8"));
  files.set(POC_LAYOUT_PATH, Buffer.from(buildPocLayout(baseLayout.toString("utf8")), "utf8"));
  files.set(POC_CSS_PATH, Buffer.from(css, "utf8"));

  const skipped = [...files.keys()].filter(isServerManagedSkinFile).sort((a, b) => a.localeCompare(b));
  const entries: ZipEntry[] = [...files]
    .filter(([path]) => !isServerManagedSkinFile(path))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, data]) => ({ path, data }));
  const productModules = bundle.components.filter((component) => component.component === "ProductGridV1").length;

  return {
    entries,
    skipped,
    slotsFilled: productModules,
    slotsAdapted: productModules,
    productModules,
    headerShared: true,
    headerOnSubPages: false,
    headerBindings: ["verified-header-v1"],
    footerRemoved: true,
    globalTheme: false,
    assetsEmbedded: assets?.files.size ?? 0,
    footerInk: resolveFooterInk(css),
    structuralFingerprint: bundle.structuralFingerprint,
  };
}

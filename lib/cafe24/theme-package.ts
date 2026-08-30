import "server-only";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectDocument } from "@/lib/project-document";
import { isProjectSource, type ProjectSource } from "@/lib/project-source";
import { prepareProjectPatch } from "@/lib/cafe24/protection";
import { buildComponentSpecThemeEntries } from "@/lib/cafe24/component-spec-theme-package";
import { assetFileName, rewriteAssetUrls, THEME_ASSET_DIR } from "@/lib/cafe24/theme-assets";
import { buildBridgeCss, buildFooterThemeCss, resolveFooterInk } from "@/lib/cafe24/theme-bridge";
import { commerceCss, composeCommerce, headerPresentationCss, headerTextToneCss, isolateAiDesignCss, renderProjectHeaderV1, resolveLegacyComposition, verifiedProductLayoutCss } from "@/lib/commerce/fixed-components";
import { brandThemeCss, footerBrandBackground, resolveProjectPalette } from "@/lib/commerce/brand-theme";
import { productDisplayOf } from "@/lib/commerce/product-display";
import { PRODUCT_SLIDE_SCRIPT, PRODUCT_SLIDE_SCRIPT_PATH } from "@/lib/cafe24/product-slide-script";
import { planLayoutCss } from "@/lib/design-library/plan-layout-css";
import { replaceFooterShell } from "@/lib/commerce/footer-shell";
import {
  BASE_INDEX_PATH,
  BASE_LAYOUT_PATH,
  bindCafe24Header,
  buildIndexHtml,
  buildMoireLayout,
  buildSubLayout,
  extractProductListModules,
  extractRootValue,
  isServerManagedSkinFile,
  MOIRE_BRIDGE_CSS_PATH,
  MOIRE_CSS_PATH,
  MOIRE_HEADER_PATH,
  MOIRE_LAYOUT_PATH,
  SUB_LAYOUT_PATHS,
} from "@/lib/cafe24/theme-template";
import type { ZipEntry } from "@/lib/zip";

export const THEME_BASE_DIR = "Guide/skin4";
export const COMMERCE_CSS_PATH = "css/moire-commerce.css";
export const CAFE24_FOOTER_PATH = "layout/basic/footer.html";

const ASSET_LIMITS = { count: 40, bytes: 5 * 1024 * 1024, totalBytes: 25 * 1024 * 1024, timeoutMs: 8000 };

/**
 * Hero·브랜드·라이프스타일 이미지를 테마 안으로 내려받습니다.
 * 실패한 항목은 원격 주소를 그대로 두어 export 자체는 언제나 성공합니다.
 */
export async function fetchThemeAssets(urls: string[]) {
  const files = new Map<string, Buffer>();
  const mapping = new Map<string, string>();
  const failed: string[] = [];
  let total = 0;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASSET_LIMITS.timeoutMs);
  try {
    for (const url of urls.slice(0, ASSET_LIMITS.count)) {
      try {
        const response = await fetch(url, { signal: controller.signal, redirect: "follow" });
        if (!response.ok) { failed.push(url); continue; }
        const fileName = assetFileName(url, response.headers.get("content-type"));
        if (!fileName) { failed.push(url); continue; }
        const data = Buffer.from(await response.arrayBuffer());
        if (!data.length || data.length > ASSET_LIMITS.bytes || total + data.length > ASSET_LIMITS.totalBytes) { failed.push(url); continue; }
        total += data.length;
        files.set(`${THEME_ASSET_DIR}/${fileName}`, data);
        mapping.set(url, fileName);
      } catch { failed.push(url); }
    }
  } finally { clearTimeout(timer); }
  return { files, mapping, failed, bytes: total };
}

export async function collectBaseSkin(baseDir: string) {
  const files = new Map<string, Buffer>();
  async function walk(relative: string) {
    const entries = await readdir(join(baseDir, relative), { withFileTypes: true });
    for (const entry of entries) {
      const next = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(next);
      else if (entry.isFile()) files.set(next, await readFile(join(baseDir, next)));
    }
  }
  await walk("");
  return files;
}

export function buildThemeEntries(base: Map<string, Buffer>, source: ProjectDocument, assets?: { files: Map<string, Buffer>; mapping: Map<string, string> }) {
  if (!isProjectSource(source)) return buildComponentSpecThemeEntries(base, source, assets);
  return buildLegacyThemeEntries(base, source, assets);
}

function buildLegacyThemeEntries(base: Map<string, Buffer>, source: ProjectSource, assets?: { files: Map<string, Buffer>; mapping: Map<string, string> }) {
  const baseIndex = base.get(BASE_INDEX_PATH);
  const baseLayout = base.get(BASE_LAYOUT_PATH);
  if (!baseIndex || !baseLayout) throw new Error("기준 스킨에 index.html 또는 layout/basic/main.html이 없습니다.");

  const mapping = assets?.mapping ?? new Map<string, string>();
  const patched = prepareProjectPatch(source);
  const themeHtml = rewriteAssetUrls(patched.html, mapping);
  const rawThemeCss = rewriteAssetUrls(source.css, mapping);
  const composition = resolveLegacyComposition(source.architecture);
  // 상품 전시 토큰은 Preview와 같은 값을 씁니다. 슬라이드일 때만 Swiper init을 테마에 싣습니다.
  const productSlide = productDisplayOf(source.commerce?.productDisplay).mode === "slide" && source.commerce?.productDisplay !== undefined;
  const themeCss = isolateAiDesignCss(rawThemeCss);
  const palette = resolveProjectPalette(source);
  const protectedCss = `${commerceCss(source.commerce, composition.headerVariant)}\n${headerTextToneCss(source.headerTextTone ?? "dark")}${source.headerPresentation ? `\n${headerPresentationCss(source.headerPresentation)}` : ""}\n${verifiedProductLayoutCss(composition.productLayout, source.commerce?.thumbRatioOverride, { productDisplay: source.commerce?.productDisplay, target: "cafe24" })}\n${buildFooterThemeCss(rawThemeCss, footerBrandBackground(palette))}\n${brandThemeCss(palette, { radius: source.commerce?.radius })}\n${planLayoutCss(source.pagePlan)}`;

  // 고정 커머스 컴포넌트를 씁니다. 상품 슬롯이 없으면 Guide module로 물러나지 않고 실패합니다.
  const composed = composeCommerce(themeHtml, "cafe24", source.commerce, composition, { includeHeader: false });
  const index = {
    html: `<!--@layout(/${MOIRE_LAYOUT_PATH})-->\n${composed.html}\n`,
    slotsFilled: composed.slots,
    slotsAdapted: composed.slots,
    footerRemoved: true,
  };
  const rootValue = extractRootValue(source.html);

  const files = new Map<string, Buffer>(base);
  for (const [path, data] of assets?.files ?? []) files.set(path, data);
  files.set(BASE_INDEX_PATH, Buffer.from(index.html, "utf8"));
  files.set(MOIRE_CSS_PATH, Buffer.from(themeCss, "utf8"));
  files.set(MOIRE_BRIDGE_CSS_PATH, Buffer.from(buildBridgeCss(rawThemeCss), "utf8"));
  files.set(MOIRE_LAYOUT_PATH, Buffer.from(buildMoireLayout(baseLayout.toString("utf8"), { rootValue, hasMoireHeader: true, productSlide }), "utf8"));
  if (productSlide) files.set(PRODUCT_SLIDE_SCRIPT_PATH, Buffer.from(PRODUCT_SLIDE_SCRIPT, "utf8"));
  const exportSource = source.headerPresentation?.logo.imageUrl
    ? { ...source, headerPresentation: { ...source.headerPresentation, logo: { ...source.headerPresentation.logo, imageUrl: rewriteAssetUrls(source.headerPresentation.logo.imageUrl, mapping) } } }
    : source;
  files.set(MOIRE_HEADER_PATH, Buffer.from(renderProjectHeaderV1("cafe24", exportSource), "utf8"));
  files.set(COMMERCE_CSS_PATH, Buffer.from(protectedCss, "utf8"));
  const footerTemplate = base.get(CAFE24_FOOTER_PATH);
  if (!footerTemplate) throw new Error("기준 스킨에 Cafe24 footer template이 없습니다.");
  files.set(CAFE24_FOOTER_PATH, Buffer.from(replaceFooterShell(footerTemplate.toString("utf8")), "utf8"));
  for (const path of SUB_LAYOUT_PATHS) {
    const original = base.get(path);
    if (original) files.set(path, Buffer.from(buildSubLayout(original.toString("utf8"), { rootValue, hasMoireHeader: true }), "utf8"));
  }

  const skipped = [...files.keys()].filter(isServerManagedSkinFile).sort((a, b) => a.localeCompare(b));
  const entries: ZipEntry[] = [...files]
    .filter(([path]) => !isServerManagedSkinFile(path))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, data]) => ({ path, data }));
  return {
    entries,
    skipped,
    slotsFilled: index.slotsFilled,
    slotsAdapted: index.slotsAdapted,
    productModules: composed.slots,
    headerShared: true,
    headerOnSubPages: true,
    headerBindings: [`header-v1/${composition.headerVariant}`],
    footerRemoved: index.footerRemoved,
    globalTheme: Boolean(rootValue),
    assetsEmbedded: assets?.files.size ?? 0,
    footerInk: resolveFooterInk(themeCss),
  };
}

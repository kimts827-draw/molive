import { commerceCss, composeCommerce, headerPresentationCss, headerTextToneCss, isolateAiDesignCss, renderProjectHeaderV1, resolveLegacyComposition, verifiedProductLayoutCss } from "../commerce/fixed-components.ts";
import { FOOTER_SHELL_CSS, renderFooterShell } from "../commerce/footer-shell.ts";
import { brandThemeCss, footerBrandBackground, resolveProjectPalette } from "../commerce/brand-theme.ts";
import { planLayoutCss } from "../design-library/plan-layout-css.ts";
import { projectPagePlan } from "../project-source.ts";
import { buildBridgeCss, buildFooterThemeCss } from "../cafe24/theme-bridge.ts";
import { renderProject, type RenderBundle } from "../component-library/index.ts";
import type { ProjectDocument } from "../project-document.ts";
import { isProjectSource } from "../project-source.ts";
import { OVERFLOW_CLIP_CSS } from "./responsive-style.ts";
import { buildStorefrontFontFaceCss } from "../fonts/storefront-fonts.ts";

export type EditorPreviewDocument = {
  kind: "legacy" | "component-spec";
  srcDoc: string;
  bundle?: RenderBundle;
  error?: string;
};

function htmlDocument(body: string, css: string) {
  // 오른쪽/아래로 옮긴 요소가 Preview 폭을 늘려 흰 공간을 만들지 않도록 문서 단위에서 잘라 냅니다.
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;min-height:100%}${OVERFLOW_CLIP_CSS}${css}</style></head><body>${body}</body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function componentSpecErrorDocument(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const body = `<main data-component-preview-error="true" style="box-sizing:border-box;min-height:100vh;padding:32px;background:#fff7f5;color:#7f1d1d;font:14px/1.65 ui-monospace,monospace"><h1 style="margin:0 0 12px;font:700 18px/1.3 ui-sans-serif,sans-serif">Component Preview를 렌더링하지 못했습니다.</h1><pre style="margin:0;white-space:pre-wrap">${escapeHtml(message)}</pre></main>`;
  return { srcDoc: htmlDocument(body, ""), error: message };
}

export function buildEditorPreviewDocument(document: ProjectDocument): EditorPreviewDocument {
  const fontFaces = buildStorefrontFontFaceCss("preview");
  if (!isProjectSource(document)) {
    try {
      const bundle = renderProject(document, "preview");
      return {
        kind: "component-spec",
        srcDoc: htmlDocument(bundle.documentHtml, `${fontFaces}\n${bundle.css}`),
        bundle,
      };
    } catch (error) {
      return { kind: "component-spec", ...componentSpecErrorDocument(error) };
    }
  }

  // Legacy ProjectSource의 기존 Preview 조합과 오류 처리를 그대로 유지합니다.
  let body: string;
  let commerce = "";
  const composition = resolveLegacyComposition(document.architecture);
  // 브랜드 색 변수는 AI CSS 뒤에 실어, AI가 색을 무시해도 코드가 선언한 값이 남게 합니다.
  const palette = resolveProjectPalette(document);
  const brandTheme = brandThemeCss(palette, { radius: document.commerce?.radius });
  // plan이 정한 tone/축을 코드가 직접 소비합니다. AI가 무시해도 화면에 남습니다.
  const planLayout = planLayoutCss(projectPagePlan(document));
  try {
    const rootValue = document.html.match(/data-moire-root="([^"]+)"/)?.[1]
      ?? `moire-${document.id.replace(/[^a-z0-9-]/gi, "").slice(0, 24)}`;
    const canvas = composeCommerce(document.html, "preview", document.commerce, composition, { includeHeader: false, previewProducts: document.previewProducts }).html;
    body = `<div id="wrap" data-moire-root="${rootValue}">${renderProjectHeaderV1("preview", document)}<div id="container"><main id="contents" role="main" data-moire-full="true">${canvas}</main></div>${renderFooterShell("preview")}</div>`;
    commerce = `${commerceCss(document.commerce, composition.headerVariant)}\n${headerTextToneCss(document.headerTextTone ?? "dark")}${document.headerPresentation ? `\n${headerPresentationCss(document.headerPresentation)}` : ""}`;
  } catch (error) {
    body = `<pre style="margin:0;padding:24px;font:13px/1.6 ui-monospace,monospace;color:#a0392e;white-space:pre-wrap">고정 커머스 컴포넌트를 넣지 못했습니다.\n${error instanceof Error ? error.message : String(error)}</pre>`;
  }
  return {
    kind: "legacy",
    srcDoc: htmlDocument(body, `${fontFaces}\n${buildBridgeCss(document.css)}\n${isolateAiDesignCss(document.css)}\n${commerce}[module="Layout_stateLogon"]{display:none}\n${verifiedProductLayoutCss(composition.productLayout, document.commerce?.thumbRatioOverride, { productDisplay: document.commerce?.productDisplay, target: "preview" })}\n${FOOTER_SHELL_CSS}\n${buildFooterThemeCss(document.css, footerBrandBackground(palette))}\n${brandTheme}\n${planLayout}`),
  };
}

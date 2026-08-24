import { POC_CSS, productGridV1 } from "../../cafe24/poc/theme-poc.ts";
import { PREVIEW_PRICE_LABEL, previewProductAt } from "../preview-mock.ts";
import type { ComponentDefinition, ComponentRenderOptions } from "../types.ts";

function canonicalProductGridV1() {
  return productGridV1(1, 8);
}

function renderPreviewProductGridV1(options: ComponentRenderOptions) {
  const product = previewProductAt(options.previewProducts, 0);
  const html = canonicalProductGridV1()
    .replace(/\s+module="[^"]+"/g, "")
    .replaceAll("{$product_no}", "sample-product-1")
    .replaceAll("{$image_medium}", product.image)
    .replaceAll("{$image_medium_id}", "sample-image-1")
    .replaceAll("{$seo_alt_tag}", product.name)
    .replaceAll("{$product_name}", product.name)
    .replaceAll("{$disp_product_price}", PREVIEW_PRICE_LABEL)
    .replaceAll("{$product_sale_price}", PREVIEW_PRICE_LABEL);
  if (/\bmodule=|\{\$/.test(html)) throw new Error("ProductGridV1 Preview binding에 Cafe24 module/variable이 남아 있습니다.");
  return html;
}

export const productGridV1Definition: ComponentDefinition = {
  id: "ProductGridV1",
  version: 1,
  category: "product-section",
  status: "verified",
  variants: ["canonical"],
  canonical: {
    source: "lib/cafe24/poc/theme-poc.ts#productGridV1(1,8)",
    cafe24HtmlSha256: "dd941c8cefd0ab8fde4e4f82d68dffd9564b218099c1df4f5f6c6322e302561c",
    cssSha256: "4ef264e5427c5646ad0f79c10408d5dac67bd95a3ca90253c6d9efc560c3624f",
  },
  css: POC_CSS,
  render(target, options = {}) {
    return target === "cafe24" ? canonicalProductGridV1() : renderPreviewProductGridV1(options);
  },
};

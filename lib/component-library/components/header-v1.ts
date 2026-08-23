import { buildPocHeader, POC_CSS } from "../../cafe24/poc/theme-poc.ts";
import type { ComponentDefinition } from "../types.ts";

function renderPreviewHeaderV1() {
  const html = buildPocHeader()
    .replace(/\s+module="[^"]+"/g, "")
    .replaceAll("{$logo}", "https://img.echosting.cafe24.com/skin/base_ko_KR/layout/h1_logo.gif")
    .replaceAll("{$mall_name}", "SAMPLE SHOP")
    .replaceAll("{$link_product_list}", "#products")
    .replaceAll("{$name_or_img_tag}", "ALL PRODUCTS")
    .replaceAll("{$action_logout}", "#logout");
  if (/\bmodule=|\{\$/.test(html)) throw new Error("HeaderV1 Preview binding에 Cafe24 module/variable이 남아 있습니다.");
  return html;
}

export const headerV1Definition: ComponentDefinition = {
  id: "HeaderV1",
  version: 1,
  category: "header",
  status: "verified",
  variants: ["canonical"],
  canonical: {
    source: "lib/cafe24/poc/theme-poc.ts#HEADER_V1",
    cafe24HtmlSha256: "18293749de97980d3903ccd830bb21ebb619579aa1d01fb1d17705dd0b81dc08",
    cssSha256: "4ef264e5427c5646ad0f79c10408d5dac67bd95a3ca90253c6d9efc560c3624f",
  },
  css: POC_CSS,
  render(target) {
    return target === "cafe24" ? buildPocHeader() : renderPreviewHeaderV1();
  },
};

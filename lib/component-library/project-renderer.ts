import { projectSpecV1Schema, type ProjectSpecV1 } from "../project-document.ts";
import { structuralFingerprint } from "./fingerprint.ts";
import { renderComponent } from "./renderer.ts";
import type { ComponentRenderArtifact, RenderTarget } from "./types.ts";

export type RenderBundleComponent = {
  instanceId: string;
  placement: "header" | "section";
  order: number;
  component: string;
  version: number;
  variant: string;
  status: "verified";
  structuralFingerprint: string;
};

export type RenderBundle = {
  target: RenderTarget;
  documentHtml: string;
  headerHtml: string;
  css: string;
  structuralFingerprint: string;
  components: RenderBundleComponent[];
};

function assertCanonicalSettings(instance: ProjectSpecV1["header"]) {
  if (instance.settings.length) throw new Error(`canonical component는 settings를 아직 허용하지 않습니다: ${instance.instanceId}`);
}

function bundleComponent(instanceId: string, placement: "header" | "section", order: number, artifact: ComponentRenderArtifact): RenderBundleComponent {
  if (artifact.status !== "verified") throw new Error(`Project render는 verified component만 허용합니다: ${artifact.component}`);
  return {
    instanceId,
    placement,
    order,
    component: artifact.component,
    version: artifact.version,
    variant: artifact.variant,
    status: artifact.status,
    structuralFingerprint: artifact.structuralFingerprint,
  };
}

export function renderProject(spec: ProjectSpecV1, target: RenderTarget): RenderBundle {
  if (target !== "preview" && target !== "cafe24") throw new Error(`지원하지 않는 render target입니다: ${String(target)}`);
  const document = projectSpecV1Schema.parse(spec);

  assertCanonicalSettings(document.header);
  const header = renderComponent({ component: document.header.component, variant: document.header.variant }, target);
  if (header.component !== "HeaderV1") throw new Error(`필수 header component는 HeaderV1입니다: ${header.component}`);

  if (document.footer) {
    const footer = renderComponent({ component: document.footer.component, variant: document.footer.variant }, target);
    throw new Error(`verified Footer component가 등록되지 않아 footer render를 허용하지 않습니다: ${footer.component}`);
  }

  if (!document.sections.some((instance) => instance.component === "ProductGridV1")) throw new Error("필수 component ProductGridV1이 누락되었습니다.");
  const sections = document.sections.map((instance) => {
    assertCanonicalSettings(instance);
    const artifact = renderComponent({ component: instance.component, variant: instance.variant }, target);
    if (artifact.component !== "ProductGridV1") throw new Error(`2B section은 ProductGridV1만 허용합니다: ${artifact.component}`);
    return { instance, artifact };
  });

  const artifacts = [header, ...sections.map(({ artifact }) => artifact)];
  const documentHtml = artifacts.map((artifact) => artifact.html).join("\n");
  const css = [...new Set(artifacts.map((artifact) => artifact.css))].join("\n");
  return {
    target,
    documentHtml,
    headerHtml: header.html,
    css,
    structuralFingerprint: structuralFingerprint(documentHtml),
    components: [
      bundleComponent(document.header.instanceId, "header", 0, header),
      ...sections.map(({ instance, artifact }, index) => bundleComponent(instance.instanceId, "section", index, artifact)),
    ],
  };
}

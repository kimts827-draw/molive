export type ComponentStatus = "verified" | "unverified";
export type RenderTarget = "preview" | "cafe24";

export type ComponentDefinition = {
  readonly id: string;
  readonly version: number;
  readonly category: "header" | "product-section" | string;
  /** ProjectSpec section으로 직접 배치하지 않고 다른 component가 조합하는 내부 기능 component입니다. */
  readonly internal?: boolean;
  readonly status: ComponentStatus;
  readonly variants: readonly string[];
  readonly canonical: {
    readonly source: string;
    readonly cafe24HtmlSha256: string;
    readonly cssSha256: string;
  };
  readonly css: string;
  render(target: RenderTarget): string;
};

export type ComponentRenderRequest = {
  component: string;
  variant: string;
};

export type ComponentRenderArtifact = {
  component: string;
  version: number;
  variant: string;
  status: ComponentStatus;
  target: RenderTarget;
  html: string;
  css: string;
  structuralFingerprint: string;
};

export type ComponentRenderBundle = {
  target: RenderTarget;
  html: string;
  css: string;
  components: ComponentRenderArtifact[];
};

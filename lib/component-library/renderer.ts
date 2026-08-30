import { structuralFingerprint } from "./fingerprint.ts";
import { verifiedComponentRegistry, type ComponentRegistry } from "./registry.ts";
import type { ComponentRenderArtifact, ComponentRenderBundle, ComponentRenderOptions, ComponentRenderRequest, RenderTarget } from "./types.ts";

export function renderComponent(
  request: ComponentRenderRequest,
  target: RenderTarget,
  registry: ComponentRegistry | undefined = verifiedComponentRegistry,
  options: ComponentRenderOptions = {},
): ComponentRenderArtifact {
  const definition = (registry ?? verifiedComponentRegistry).resolve(request.component, request.variant, target);
  // variant별로 DOM이 갈리는 component가 있으므로 요청 variant를 render options로 넘깁니다.
  const html = definition.render(target, { ...options, variant: request.variant });
  return {
    component: definition.id,
    version: definition.version,
    variant: request.variant,
    status: definition.status,
    target,
    html,
    css: definition.css,
    structuralFingerprint: structuralFingerprint(html),
  };
}

export function renderComponents(
  requests: readonly ComponentRenderRequest[],
  target: RenderTarget,
  registry: ComponentRegistry = verifiedComponentRegistry,
): ComponentRenderBundle {
  const components = requests.map((request) => renderComponent(request, target, registry));
  const styles = [...new Set(components.map((component) => component.css).filter(Boolean))];
  return {
    target,
    html: components.map((component) => component.html).join("\n"),
    css: styles.join("\n"),
    components,
  };
}

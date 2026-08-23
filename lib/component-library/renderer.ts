import { structuralFingerprint } from "./fingerprint.ts";
import { verifiedComponentRegistry, type ComponentRegistry } from "./registry.ts";
import type { ComponentRenderArtifact, ComponentRenderBundle, ComponentRenderRequest, RenderTarget } from "./types.ts";

export function renderComponent(
  request: ComponentRenderRequest,
  target: RenderTarget,
  registry: ComponentRegistry = verifiedComponentRegistry,
): ComponentRenderArtifact {
  const definition = registry.resolve(request.component, request.variant, target);
  const html = definition.render(target);
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

import { headerV1Definition } from "./components/header-v1.ts";
import { productCardV1Definition } from "./components/product-card-v1.ts";
import { productGridV1Definition } from "./components/product-grid-v1.ts";
import { productSectionV1Definition } from "./components/product-section-v1.ts";
import type { ComponentDefinition, RenderTarget } from "./types.ts";

export class ComponentRegistry {
  readonly #definitions: Map<string, ComponentDefinition>;

  constructor(definitions: readonly ComponentDefinition[]) {
    this.#definitions = new Map();
    for (const definition of definitions) {
      if (this.#definitions.has(definition.id)) throw new Error(`중복된 component 등록입니다: ${definition.id}`);
      this.#definitions.set(definition.id, definition);
    }
  }

  list() {
    return [...this.#definitions.values()];
  }

  resolve(component: string, variant: string, target: RenderTarget) {
    const definition = this.#definitions.get(component);
    if (!definition) throw new Error(`등록되지 않은 component입니다: ${component}`);
    if (!definition.variants.includes(variant)) throw new Error(`등록되지 않은 component variant입니다: ${component}/${variant}`);
    if (target === "cafe24" && definition.status !== "verified") throw new Error(`Cafe24 render는 verified component만 허용합니다: ${component}`);
    return definition;
  }
}

export function createComponentRegistry(definitions: readonly ComponentDefinition[]) {
  return new ComponentRegistry(definitions);
}

export const verifiedComponentRegistry = createComponentRegistry([
  headerV1Definition,
  productGridV1Definition,
  productCardV1Definition,
  productSectionV1Definition,
]);

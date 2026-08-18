import { editorial } from "./editorial.ts";
import { manifesto } from "./manifesto.ts";
import { product } from "./product.ts";
import { terminal } from "./terminal.ts";
import type { Template, TemplateId } from "./types.ts";

/**
 * The four house templates, in picker order.
 *
 * Ids match `keccak256(id)` on HoodfiSites, so the contract's template registry and this
 * list cannot drift apart without the publish reverting — which is the right failure.
 * A silent mismatch would pay a partner for a design nobody used.
 */
export const TEMPLATES: Template[] = [terminal, editorial, manifesto, product];

export const TEMPLATES_BY_ID: Record<TemplateId, Template> = {
  terminal,
  editorial,
  manifesto,
  product,
};

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export type { SiteData, SiteLink, Template, TemplateId } from "./types.ts";
export { EMPTY_SITE } from "./types.ts";

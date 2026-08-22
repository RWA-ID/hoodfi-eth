import { TEMPLATES_BY_ID } from "./index.ts";
import { EMPTY_SITE, type SiteData, type TemplateId } from "./types.ts";

/**
 * Which fields a template actually puts on the page.
 *
 * Asked of the renderer rather than kept as a list beside it. A hand-maintained table of
 * "Terminal shows figures, Manifesto doesn't" is a second source of truth that drifts the
 * first time a template is edited, and the drift is invisible: the form keeps offering a
 * field, the preview keeps not showing it, and nobody finds out until a published site is
 * missing something someone typed. That happened — two figures were typed into a
 * Manifesto site, paid for, and never appeared.
 *
 * So: render each template once with a distinctive probe in every optional field, and see
 * which probes survive into the HTML. The templates are pure deterministic functions of
 * their data, which is what makes this legitimate rather than a guess.
 */

/** Fields a template is free to ignore. Not the headline — every template renders that. */
export type OptionalField =
  | "facts"
  | "links"
  | "avatar"
  | "bio"
  | "tagline"
  | "x"
  | "github"
  | "telegram"
  | "discord"
  | "website"
  | "opensea"
  | "ethAddress"
  | "btcAddress"
  | "solAddress";

/**
 * Probes are lowercase alphanumeric on purpose: `esc`, `handle` and `safeUrl` all pass
 * them through unchanged, so a missing probe means the template dropped the field rather
 * than that a helper rewrote it.
 */
const PROBE: Record<OptionalField, string> = {
  facts: "zzfactzz",
  links: "zzlinkzz",
  avatar: "zzavatarzz",
  bio: "zzbiozz",
  tagline: "zztaglinezz",
  x: "zzxzz",
  github: "zzgithubzz",
  telegram: "zztelegramzz",
  discord: "zzdiscordzz",
  website: "zzwebsitezz",
  opensea: "zzopenseazz",
  ethAddress: "zzethaddrzz",
  btcAddress: "zzbtcaddrzz",
  solAddress: "zzsoladdrzz",
};

const PROBE_DATA: SiteData = {
  ...EMPTY_SITE,
  label: "probe",
  displayName: "Probe",
  tagline: PROBE.tagline,
  bio: PROBE.bio,
  // An https URL, because `safeImage`/`safeUrl` reject anything else and a rejected value
  // would read as "the template ignores this field".
  avatar: `https://example.com/${PROBE.avatar}.png`,
  links: [{ label: PROBE.links, url: `https://example.com/${PROBE.links}` }],
  facts: [{ label: PROBE.facts, value: "1234" }],
  x: PROBE.x,
  github: PROBE.github,
  telegram: PROBE.telegram,
  discord: PROBE.discord,
  website: `https://example.com/${PROBE.website}`,
  opensea: `https://opensea.io/${PROBE.opensea}`,
  ethAddress: PROBE.ethAddress,
  btcAddress: PROBE.btcAddress,
  solAddress: PROBE.solAddress,
};

const cache = new Map<TemplateId, Set<OptionalField> | null>();

/**
 * The fields `templateId` does NOT render, or null when that could not be determined.
 *
 * Null rather than an empty set on failure, so a caller shows no warning at all instead of
 * confidently claiming every field is fine. `fitSize` measures on a canvas, and a renderer
 * throwing during prerender must not turn into "this template shows everything".
 */
export function omittedFields(templateId: TemplateId): Set<OptionalField> | null {
  const cached = cache.get(templateId);
  if (cached !== undefined) return cached;

  let result: Set<OptionalField> | null;
  try {
    const template = TEMPLATES_BY_ID[templateId];
    if (!template) throw new Error("unknown template");
    const html = template.render(PROBE_DATA);
    result = new Set(
      (Object.keys(PROBE) as OptionalField[]).filter((field) => !html.includes(PROBE[field]))
    );
  } catch {
    result = null;
  }

  cache.set(templateId, result);
  return result;
}

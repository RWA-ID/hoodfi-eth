/**
 * This app's own identity.
 *
 * Simpler than the site's equivalent on purpose: this one ships to exactly one origin,
 * so there is no IPFS-vs-host split to reconcile and no reason for a separate canonical.
 * If that ever stops being true, copy the site's two-constant arrangement rather than
 * overloading this one.
 */
export const SITE = {
  name: "HoodFi Sites",
  description:
    "Turn your HoodFi name into a website. Pick a template, add your details, publish it to IPFS — your name serves the site, forever.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://build.hoodfi.name").replace(/\/$/, ""),
} as const;

/** Where a visitor without a name is sent to get one. */
export const MINT_URL = "https://www.hoodfi.name/mint/";

/** Where an owner manages records by hand, for anything this builder doesn't cover. */
export const MANAGE_URL = "https://www.hoodfi.name/manage/";

/** The project's own accounts, linked from the footer. */
export const X_URL = "https://x.com/hoodfieth";
export const DISCORD_URL = "https://discord.gg/4x7pY9jXK";

/**
 * Template submissions post here — the same worker endpoint the site's partner form
 * uses, distinguished by `topic: "template"`. One handler, one mail credential, one
 * place spam defence has to be right.
 */
export const PARTNER_URL =
  process.env.NEXT_PUBLIC_PARTNER_URL ??
  "https://hoodfi-gateway.dmpay.workers.dev/partner";

/** The partner share of every publish on a partner template. */
export const PARTNER_SHARE = "30%";

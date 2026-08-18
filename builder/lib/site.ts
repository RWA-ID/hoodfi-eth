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

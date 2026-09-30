/**
 * What a published site is made of.
 *
 * One shape for all five templates. A template may ignore any field, but none may
 * invent one — otherwise switching template silently loses whatever the visitor typed,
 * which is the worst moment to discover a data model disagreement.
 */
export type SiteLink = {
  label: string;
  url: string;
};

/**
 * A short labelled figure, shown in the stat blocks.
 *
 * These used to be hardcoded product facts — expiry ∞, renewals $0, chain 4663 — which
 * are true of every HoodFi name and therefore say nothing about the person whose site it
 * is. Three cells of prime space describing the platform rather than the owner. They are
 * the owner's to fill now.
 */
export type SiteFact = {
  label: string;
  value: string;
};

/**
 * One row on a Links page.
 *
 * `visible: false` keeps a block in the draft but off the page — hiding a link for a week
 * should not mean retyping it. Every variant carries `title` and `url` so the form can
 * treat them uniformly; what `url` means depends on the type (an address for a tip jar,
 * a form endpoint for an email signup).
 */
export type LinkBlock =
  | {
      id: string;
      type: "link";
      title: string;
      url: string;
      featured: boolean;
      /**
       * Thumbnail image, https or ipfs. Absent means no thumbnail; an empty string means
       * the owner switched one on and has not filled it in yet — the form shows the field,
       * the page shows nothing.
       */
      thumb?: string;
      visible: boolean;
    }
  | { id: string; type: "header"; title: string; url: string; visible: boolean }
  /** YouTube, Spotify or SoundCloud. The provider is read off the URL, never chosen. */
  | { id: string; type: "embed"; title: string; url: string; visible: boolean }
  | { id: string; type: "image"; title: string; url: string; visible: boolean }
  /** `url` is the address tips go to. Empty means the name's own ETH address. */
  | { id: string; type: "tip"; title: string; url: string; amounts: string; visible: boolean }
  /** `url` is a form endpoint the owner controls — the page itself is a static file. */
  | { id: string; type: "email"; title: string; url: string; button: string; visible: boolean };

export type LinkBlockType = LinkBlock["type"];

/** How a Links page looks. Ignored by every other template. */
export type LinksLook = {
  preset: "fill" | "outline" | "glass" | "brutal" | "accent" | "minimal";
  mode: "dark" | "light";
  accent: "lime" | "orange" | "blue" | "purple" | "bronze" | "silver";
  font: "archivo" | "grotesk" | "dmsans" | "serif" | "mono" | "syne";
  shape: "square" | "rounded" | "pill";
  bg: "solid" | "glow" | "band" | "grid";
  /** The "made on HoodFi Sites" line. */
  badge: boolean;
};

export const DEFAULT_LOOK: LinksLook = {
  preset: "brutal",
  mode: "dark",
  accent: "lime",
  font: "grotesk",
  shape: "rounded",
  bg: "glow",
  badge: true,
};

export type SiteData = {
  /** The HoodFi label, without the parent. The site's identity and its address. */
  label: string;

  /**
   * The headline: the big line at the top.
   *
   * NOT defaulted to the label any more. It was, silently, and that made the largest
   * thing on the page a choice the software made — a preview showing your own label
   * looks finished, so nobody edits it. The editor asks for one and refuses to publish
   * without it. Templates still fall back to the label rather than render an empty h1,
   * but in the editor that path is unreachable.
   */
  displayName: string;
  /** One line under it. */
  tagline: string;
  /** A paragraph or several. Plain text; newlines become paragraphs. */
  bio: string;

  /**
   * Picture. An https URL or an ipfs:// URI — never a data URL, which would be
   * duplicated into every page that shows it.
   */
  avatar: string;

  links: SiteLink[];
  /** Up to three. Rendered where a template has stat cells. */
  facts: SiteFact[];

  /** Handles, not URLs. The template builds the address so it can't be malformed. */
  x: string;
  github: string;
  telegram: string;
  discord: string;
  website: string;

  /** Full OpenSea URL, since collections and profiles have different shapes. */
  opensea: string;

  /** Addresses to show. Copy targets, not links. */
  ethAddress: string;
  btcAddress: string;
  solAddress: string;

  /*
   * Links only, below. Kept on the one shape rather than in a side object so that
   * switching template and back never loses a block — the rule at the top of this file.
   */

  /** Ordered rows of a Links page. Up to 24. */
  blocks: LinkBlock[];
  /** More handles. Same rule as `x`: handles, not URLs. */
  instagram: string;
  tiktok: string;
  youtube: string;
  farcaster: string;
  /** A plain address, rendered as a mailto: icon. */
  email: string;
  /** Social icons under the bio, or at the foot of the page. */
  socialPos: "top" | "bottom";
  look: LinksLook;
};

export const EMPTY_SITE: SiteData = {
  label: "",
  displayName: "",
  tagline: "",
  bio: "",
  avatar: "",
  links: [],
  facts: [],
  x: "",
  github: "",
  telegram: "",
  discord: "",
  website: "",
  opensea: "",
  ethAddress: "",
  btcAddress: "",
  solAddress: "",
  blocks: [],
  instagram: "",
  tiktok: "",
  youtube: "",
  farcaster: "",
  email: "",
  socialPos: "top",
  look: DEFAULT_LOOK,
};

export type TemplateId = "terminal" | "editorial" | "manifesto" | "product" | "links";

export type Template = {
  id: TemplateId;
  name: string;
  blurb: string;
  /** Who it's for, shown under the name in the picker. */
  audience: string;
  /** Flags a recent addition in the picker. Take it off once it stops being news. */
  isNew?: boolean;
  /**
   * Renders the whole page.
   *
   * Returns a complete standalone HTML document — the same string used for the live
   * preview and for the file that gets pinned. Deliberately one function rather than a
   * React component plus an exporter: two renderers means the preview can disagree with
   * what someone paid to publish, and they would only find out afterwards.
   */
  render: (data: SiteData) => string;
};

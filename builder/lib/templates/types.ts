/**
 * What a published site is made of.
 *
 * One shape for all four templates. A template may ignore any field, but none may
 * invent one — otherwise switching template silently loses whatever the visitor typed,
 * which is the worst moment to discover a data model disagreement.
 */
export type SiteLink = {
  label: string;
  url: string;
};

export type SiteData = {
  /** The HoodFi label, without the parent. The site's identity and its address. */
  label: string;

  /** Big name at the top. Defaults to the label if left empty. */
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
};

export const EMPTY_SITE: SiteData = {
  label: "",
  displayName: "",
  tagline: "",
  bio: "",
  avatar: "",
  links: [],
  x: "",
  github: "",
  telegram: "",
  discord: "",
  website: "",
  opensea: "",
  ethAddress: "",
  btcAddress: "",
  solAddress: "",
};

export type TemplateId = "terminal" | "editorial" | "manifesto" | "product";

export type Template = {
  id: TemplateId;
  name: string;
  blurb: string;
  /** Who it's for, shown under the name in the picker. */
  audience: string;
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

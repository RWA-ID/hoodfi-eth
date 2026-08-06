import type { Metadata } from "next";
import { CANONICAL_URL, SITE } from "./site";

/**
 * Builds a complete per-route card.
 *
 * Next *replaces* `openGraph` and `twitter` rather than merging them with the root
 * layout's, so a page that sets only a title silently drops the image, the type and
 * the card size. Every route therefore has to emit the full object — this helper
 * makes that the default instead of something you remember to do.
 */
export function ogMetadata({
  title,
  description,
  path,
  image = "/og/default.png",
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  const fullTitle = `${title} · ${SITE.name}`;
  const url = `${SITE.url}${path}`;
  const canonical = `${CANONICAL_URL}${path}`;
  // Absolute, because the card is fetched by crawlers that have no page context —
  // and the site is also served from IPFS gateways under a different origin.
  const imageUrl = `${SITE.url}${image}`;

  return {
    title: fullTitle,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      title: fullTitle,
      description,
      url,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: fullTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [imageUrl],
      site: "@hoodfieth",
    },
  };
}

import type { Metadata } from "next";
import { SITE } from "./site";

/**
 * Per-route Open Graph metadata.
 *
 * Every page in this app is a client component, and a client component cannot export
 * `metadata` — so each route that needs its own card gets a server `layout.tsx` beside
 * it whose only job is to export this. Without that, every share link on the whole
 * domain resolves to one card, which is the shape the main site was bitten by.
 *
 * Next REPLACES openGraph and twitter rather than merging them, so each call has to
 * restate the whole object; inheriting half of it from the root layout silently drops
 * the other half.
 */
export function ogMetadata(args: {
  title: string;
  description: string;
  path: string;
  image: string;
}): Metadata {
  const url = `${SITE.url}${args.path}`;
  // Absolute, because a crawler has no base to resolve a relative image against.
  const image = `${SITE.url}${args.image}`;
  return {
    title: `${args.title} · ${SITE.name}`,
    description: args.description,
    alternates: { canonical: url },
    openGraph: {
      title: args.title,
      description: args.description,
      url,
      siteName: SITE.name,
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: args.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: args.title,
      description: args.description,
      images: [image],
    },
  };
}

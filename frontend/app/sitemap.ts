import type { MetadataRoute } from "next";
import { CANONICAL_URL } from "@/lib/site";

/**
 * Sitemap for the canonical origin.
 *
 * Deliberately built from CANONICAL_URL, not SITE.url: the same export ships to two
 * places (the conventional host and IPFS), and a sitemap that advertised whichever
 * origin happened to build it would ask Google to index both copies against each
 * other. Every build points at the one address we want ranked.
 *
 * /claim/ is omitted on purpose — it exists only to redirect old shared links to
 * /mint/ and has nothing to index.
 */
const ROUTES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/mint/", priority: 0.9 },
  { path: "/manage/", priority: 0.7 },
  { path: "/faq/", priority: 0.6 },
  { path: "/terms/", priority: 0.2 },
  { path: "/privacy/", priority: 0.2 },
  { path: "/disclaimer/", priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map(({ path, priority }) => ({
    url: `${CANONICAL_URL}${path}`,
    lastModified,
    changeFrequency: priority >= 0.9 ? "weekly" : "monthly",
    priority,
  }));
}

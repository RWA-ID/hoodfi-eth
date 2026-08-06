import type { MetadataRoute } from "next";
import { CANONICAL_URL } from "@/lib/site";

// Metadata routes are dynamic by default; `output: export` refuses to build one
// that hasn't opted into being a static file.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${CANONICAL_URL}/sitemap.xml`,
    host: CANONICAL_URL,
  };
}

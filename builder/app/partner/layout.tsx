import type { Metadata } from "next";
import { ogMetadata } from "@/lib/metadata";

/**
 * Metadata only. `app/partner/page.tsx` is a client component and cannot export
 * `metadata` itself — without this file the route would inherit the root card and every
 * share link on the domain would look identical.
 */
export const metadata: Metadata = ogMetadata({
  title: "Partner with HoodFi Sites",
  description: "Bring a template your holders can build on, and earn 30% of every site published with it.",
  path: "/partner/",
  image: "/og/partner.png",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

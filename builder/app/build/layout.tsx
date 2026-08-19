import type { Metadata } from "next";
import { ogMetadata } from "@/lib/metadata";

/**
 * Metadata only. `app/build/page.tsx` is a client component and cannot export
 * `metadata` itself — without this file the route would inherit the root card and every
 * share link on the domain would look identical.
 */
export const metadata: Metadata = ogMetadata({
  title: "Build your site",
  description: "Pick a template, add your details, publish. Your HoodFi name serves the site itself.",
  path: "/build/",
  image: "/og/build.png",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

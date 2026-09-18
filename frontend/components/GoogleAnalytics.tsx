"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { gaPageView } from "@/lib/gtag";

/**
 * One GA page_view per client-side navigation.
 *
 * gtag('config') reports the initial load and nothing after it: every route change in
 * this app is a pushState the tag never observes, so without this the whole site
 * reports as a single landing page and every internal route reads as zero traffic.
 *
 * Deliberately not folded into <PageView />, which would have been the obvious reuse.
 * That component is mounted on 9 of the 13 routes — /privacy, /terms and /disclaimer
 * carry none — so a GA page_view hanging off it would silently under-report exactly the
 * pages nobody thinks to check. This mounts once in the root layout and therefore
 * covers every route by construction, including any added later.
 *
 * A client component here does not make the layout one: the layout stays a server
 * component, which is what keeps per-route OG cards working.
 */
export function GoogleAnalytics() {
  const pathname = usePathname();
  const seenFirstRender = useRef(false);

  useEffect(() => {
    // The initial load is gtag('config')'s to report, not ours.
    if (!seenFirstRender.current) {
      seenFirstRender.current = true;
      return;
    }
    gaPageView(pathname);
  }, [pathname]);

  return null;
}

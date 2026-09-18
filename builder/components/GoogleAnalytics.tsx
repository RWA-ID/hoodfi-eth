"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { gaPageView } from "@/lib/gtag";

/**
 * One GA page_view per client-side navigation.
 *
 * gtag('config') reports the initial load and nothing after it: every route change in
 * this app is a pushState the tag never observes. That matters more here than on the
 * site — /build is where the whole funnel happens, and it is almost always reached by
 * a client-side navigation from the landing page, so without this the one page worth
 * measuring is the one that never appears in a report.
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

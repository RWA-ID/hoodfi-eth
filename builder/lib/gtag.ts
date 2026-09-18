/**
 * Google Analytics 4 (gtag.js) for HoodFi Sites.
 *
 * A **different property** from the main site's: build.hoodfi.name is its own product
 * with its own funnel, and mixing the two into one property would make the site's
 * traffic and the builder's conversions indistinguishable in every report. Keep them
 * separate — there is no cross-domain linking configured, and adding it would defeat
 * the point of having split them.
 *
 * The measurement ID is inlined into the client bundle at build time, which is fine —
 * a GA measurement ID is public by design and is readable in the page source of every
 * tagged site on the web. It is not a credential.
 */
export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_ID ?? "G-H7KS87XPR5";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Report one page_view for a client-side navigation.
 *
 * Only for route changes after the first paint: the `gtag('config')` call in the root
 * layout already reports the initial load, and reporting it here too would double every
 * landing in the session.
 */
export function gaPageView(path: string) {
  if (typeof window === "undefined" || !window.gtag || !GA_MEASUREMENT_ID) return;

  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

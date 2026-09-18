/**
 * Google Analytics 4 (gtag.js).
 *
 * Deliberately a separate file from lib/analytics.ts. That one is our own funnel, and
 * its promise — "No cookies, no fingerprinting, no wallet addresses, no localStorage" —
 * has to stay literally true for anyone who opens it. GA is a different bargain: it
 * sets its own first-party cookie and reports to Google. Folding the two into one file
 * would have turned that comment into a lie the first time someone read it.
 *
 * The measurement ID is inlined into the client bundle at build time, which is fine —
 * a GA measurement ID is public by design and is readable in the page source of every
 * tagged site on the web. It is not a credential.
 */
export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_ID ?? "G-XQ3DNH4XVL";

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

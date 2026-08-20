/**
 * Cookieless funnel instrumentation.
 *
 * The site is served from IPFS, so there are no server logs to mine — without this
 * there is no way to tell "nobody visited" apart from "people visited and bounced",
 * which are opposite problems with opposite fixes.
 *
 * Sends an event name plus a few low-cardinality fields to our own Worker. No cookies,
 * no fingerprinting, no wallet addresses, no localStorage — the session id lives in
 * sessionStorage and dies with the tab. Silently no-ops when unconfigured.
 */

const ENDPOINT = process.env.NEXT_PUBLIC_ANALYTICS_URL ?? "";

export type TrackEvent =
  | "page_view"
  | "name_searched"
  | "mint_started"
  | "mint_completed"
  | "mint_failed"
  | "donate_started"
  | "donate_completed"
  | "voucher_requested"
  | "short_mint_started"
  | "short_mint_completed"
  | "record_saved"
  | "avatar_uploaded"
  | "share_clicked"
  | "site_visited"
  | "connect_opened"
  | "partner_submitted"
  | "subnames_created"
  | "name_transferred"
  /* Handing off to HoodFi Sites, which is a separate deployment — this is the last
     event we can see, so `from` is the only way to tell which of the three entry
     points is actually feeding it. */
  | "builder_opened";

type Props = Record<string, string | number | boolean | undefined>;

function sessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const KEY = "hoodfi.sid";
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Private mode / storage disabled — events still send, just unlinked.
    return "";
  }
}

/** Referrer host only. The full URL can carry search terms and identifiers. */
function referrerHost(): string {
  if (typeof document === "undefined" || !document.referrer) return "";
  try {
    const host = new URL(document.referrer).hostname;
    return host === window.location.hostname ? "" : host;
  } catch {
    return "";
  }
}

export function track(event: TrackEvent, props: Props = {}) {
  if (!ENDPOINT || typeof window === "undefined") return;

  const body = JSON.stringify({
    e: event,
    p: window.location.pathname,
    r: referrerHost(),
    s: sessionId(),
    ...props,
  });

  try {
    // sendBeacon survives the page unloading mid-navigation, which is exactly when
    // outbound-click and share events fire.
    //
    // The blob must be text/plain, not application/json. sendBeacon always sends with
    // credentials mode "include", and a credentialed request rejects the wildcard
    // `Access-Control-Allow-Origin: *` the Worker returns — so an application/json
    // blob (which needs a preflight) is blocked by CORS and every event is lost.
    // text/plain makes it a simple request: no preflight, no CORS failure. The Worker
    // parses the body with .json() regardless of the declared content type.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain;charset=UTF-8" }));
      return;
    }
    void fetch(ENDPOINT, { method: "POST", body, keepalive: true });
  } catch {
    // Analytics must never break the app.
  }
}

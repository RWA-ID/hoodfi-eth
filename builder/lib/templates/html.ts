/**
 * Turning what someone typed into markup, safely.
 *
 * Everything here handles attacker-controlled input. A published site is a static file
 * on a `*.hoodfi.eth.link` origin, so a template that interpolates raw text is an XSS
 * hole on a subdomain of the parent name — and one that we pinned, permanently, and
 * whose CID we cannot retract. There is no "fix it in the next deploy" for a bad pin.
 *
 * Everything a template emits goes through `esc` or `attr`, and every URL through
 * `safeUrl`. No exceptions, including for fields that "can only be a handle".
 */

/**
 * Where "Built with HoodFi Sites" goes.
 *
 * Every published site carries one link back. It is the only outbound reference we put
 * on someone else's page, so it points at the builder rather than the marketing site —
 * a visitor who likes the page is one click from making their own.
 */
export const BUILDER_URL = "https://build.hoodfi.name/";

/** HTML text-node escaping. */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Attribute escaping.
 *
 * Same as `esc` today, kept separate because the two have different rules the moment
 * anything is emitted unquoted, and a single named helper is what makes "did this go
 * through the right one" answerable by reading.
 */
export function attr(value: string): string {
  return esc(value);
}

/**
 * A URL we are willing to put in an href.
 *
 * The allowlist is the point. `javascript:` is the obvious one, but `data:` is just as
 * bad — a data: URL carrying HTML executes on our origin when clicked — and `vbscript:`
 * still runs in enough places to be worth naming. Anything not plainly http(s), mailto
 * or ipfs is dropped rather than sanitised: guessing what someone meant by a scheme we
 * do not recognise is how sanitisers get bypassed.
 *
 * Returns "" for anything rejected, and every template treats "" as "render no link".
 */
export function safeUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";

  // A bare domain is the most common thing people type into a "website" field.
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+(\/.*)?$/i.test(value)) {
    return `https://${value}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "";
  }

  const scheme = parsed.protocol.toLowerCase();
  if (scheme === "http:" || scheme === "https:" || scheme === "mailto:") return parsed.href;
  if (scheme === "ipfs:") return ipfsToHttp(value);
  return "";
}

/**
 * IPFS gateway order.
 *
 * Ours first because ipfs.io has been measured at 25 seconds against our 1 — long
 * enough that a freshly saved image reads as not saved at all. The fallback is
 * mandatory, though: our gateway 403s CIDs it has not pinned, which is most of them
 * for content a visitor brought from elsewhere.
 */
export const IPFS_GATEWAYS = ["https://ipfs.onchain-id.id/ipfs/", "https://ipfs.io/ipfs/"];

/**
 * How big a copy of an image to ask the gateway for, and how it may be reshaped.
 *
 * Our gateway is a Pinata one, so it resizes on the way out — and a published site is
 * exactly where that matters most, because the HTML is pinned to IPFS and served to every
 * visitor of that site with no rebuild path short of republishing it. A real avatar record
 * measured 480KB at 512x512; the largest slot any template paints it into is 140px, and
 * the smallest is a 30px mark.
 *
 * `cover` crops to a square, which is what the page slots are. `scale-down` never enlarges
 * — it is the cap for a slot that wants the biggest copy available rather than a specific
 * size, and it is why a 512px source asked for 640 comes back untouched at 512.
 */
export type ImageSize = { px: number; fit: "cover" | "scale-down" };

/**
 * The square boxes a template draws an avatar in: 140px at the largest (`.pfp` on a wide
 * screen), 30px at the smallest. 280 keeps the large one crisp on a 2x display.
 */
export const PAGE_AVATAR: ImageSize = { px: 280, fit: "cover" };

/**
 * The social card, which wants the opposite of the page slots.
 *
 * Shrinking this is the failure mode, not the fix: every template declares
 * `summary_large_image`, which X will decline to render below roughly 300x157, and a card
 * that fails to render is indistinguishable from a link with no card at all. So this only
 * caps a genuinely huge upload — `scale-down` leaves anything already smaller exactly as
 * it is, rather than upscaling a small avatar into a soft one.
 */
export const OG_AVATAR: ImageSize = { px: 640, fit: "scale-down" };

function resizeQuery(size?: ImageSize): string {
  if (!size) return "";
  const box = size.fit === "cover" ? `img-width=${size.px}&img-height=${size.px}` : `img-width=${size.px}`;
  return `?${box}&img-fit=${size.fit}&img-format=png`;
}

/**
 * `size` is honoured only on our own gateway. The parameters are Pinata's, and the caller
 * can pass any gateway here — appending them to a URL on a host that does not understand
 * them is at best ignored and at worst a 404 on the one image the page needed.
 */
export function ipfsToHttp(uri: string, gateway = IPFS_GATEWAYS[0], size?: ImageSize): string {
  const path = uri.replace(/^ipfs:\/\/(ipfs\/)?/, "");
  if (!/^[A-Za-z0-9]+(\/.*)?$/.test(path)) return "";
  return gateway + path + (gateway === IPFS_GATEWAYS[0] ? resizeQuery(size) : "");
}

/**
 * An image src, with the same scheme rules as a link.
 *
 * `size` applies to `ipfs://` records only. An author can paste an `https://` URL to any
 * host, and that host has no reason to understand Pinata's resize parameters — so a
 * pasted URL is passed through exactly as given, unresized.
 */
export function safeImage(raw: string, size?: ImageSize): string {
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith("ipfs://")) return ipfsToHttp(value, IPFS_GATEWAYS[0], size);
  const url = safeUrl(value);
  return url.startsWith("http") ? url : "";
}

/**
 * The second gateway to try for an `ipfs://` image, as a `data-fallback` attribute.
 *
 * A published site is the one place in this codebase with no fallback chain: the app and
 * the card renderer both walk a candidate list, but generated HTML got a single URL on our
 * own gateway — and that gateway serves **only what this account pinned** and 403s
 * everything else ([[reference-pinata-dedicated-gateway]]). The avatar field takes any URI
 * its owner types, so an author whose picture is pinned somewhere else published a site
 * with a permanently broken image and nothing behind it.
 *
 * It has to be an attribute plus a listener rather than a build-time choice, because which
 * gateway works is not knowable when the HTML is written — only when it loads. No resize
 * parameters on this one: they are Pinata's, and ipfs.io would serve the full file anyway.
 *
 * Empty for a pasted `https://` URL. There is no second host to try for someone else's
 * server, and guessing one would be inventing a URL the author never gave us.
 */
export function fallbackAttr(raw: string): string {
  const value = raw.trim();
  if (!value.startsWith("ipfs://")) return "";
  const url = ipfsToHttp(value, IPFS_GATEWAYS[1]);
  return url ? ` data-fallback="${attr(url)}"` : "";
}

/**
 * Swap an image to its second gateway when the first one fails to serve it.
 *
 * Listens in the **capture** phase: `error` from an `<img>` does not bubble, so a
 * delegated listener without the third argument never fires — the one detail that decides
 * whether this file is a working fallback or a decoration. Capture also means one listener
 * for the whole page instead of an inline handler on every tag.
 *
 * The attribute is removed before the retry, so a CID that neither gateway can serve fails
 * once and stops rather than ping-ponging forever.
 */
export const IMG_FALLBACK_SCRIPT = `
document.addEventListener('error',function(e){
  var i=e.target;
  if(!i||i.tagName!=='IMG')return;
  var f=i.getAttribute('data-fallback');
  if(!f)return;
  i.removeAttribute('data-fallback');
  i.src=f;
},true);`.trim();

/** Plain text into paragraphs, escaped. Blank lines separate; single newlines break. */
export function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${esc(block).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

/** A social handle stripped of the decorations people paste with it. */
export function handle(raw: string): string {
  return raw.trim().replace(/^@/, "").replace(/^https?:\/\/[^/]+\//i, "").replace(/\/$/, "");
}

/** `0x1234…abcd`, for an address shown rather than read. */
/**
 * The largest whole-pixel font size at which `text` fits `available` px on one line.
 *
 * Templates set a headline from a field a stranger fills in, so no fixed size is safe:
 * the handoff's own sizes are chosen for the handoff's own two-word example, and a real
 * name broke mid-word under the portrait. Rather than let it wrap into nonsense, the size
 * comes down until the longest word fits.
 *
 * `adv` is the face's own advance table in thousandths of an em, generated beside the
 * font — see build-fonts.sh. A single average cannot stand in for it on a proportional
 * face: Archivo at wdth=125 runs 0.35em to 1.19em per character.
 *
 * `tracking` is the template's letter-spacing in em, and it counts: -0.035em over
 * fourteen characters is half a character back.
 */
export function fitSize(
  text: string,
  adv: Record<number, number>,
  available: number,
  max: number,
  min: number,
  tracking = 0
): number {
  const chars = [...text];
  if (chars.length === 0) return max;
  // 1000 for anything the table does not carry — wider than every glyph in it, so an
  // accented character errs toward shrinking rather than toward overflowing.
  let em = 0;
  for (const ch of chars) em += (adv[ch.codePointAt(0) ?? 0] ?? 1000) / 1000 + tracking;
  if (em <= 0) return max;
  return Math.max(min, Math.min(max, Math.floor(available / em)));
}

export function shortAddress(value: string): string {
  const v = value.trim();
  if (v.length <= 14) return v;
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

/**
 * The one script every template ships: copy-to-clipboard for address rows.
 *
 * Inline and tiny because a published page must not fetch anything. Written to do
 * nothing at all if the API is missing, rather than throw into a console nobody sees.
 */
export const COPY_SCRIPT = `
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-copy]');
  if(!b||!navigator.clipboard)return;
  navigator.clipboard.writeText(b.getAttribute('data-copy')).then(function(){
    var t=b.getAttribute('data-label')||b.textContent;
    b.setAttribute('data-label',t);
    b.textContent='copied';
    setTimeout(function(){b.textContent=t;},1400);
  }).catch(function(){});
});`.trim();

/**
 * Hash anchors inside an iframe preview.
 *
 * In a `srcdoc` iframe on Safari and some Chrome builds, `<a href="#x">` navigates the
 * *parent* to `parent-url#x` and replaces the preview with a copy of the builder. The
 * published page does not need this, but it costs a line and the preview is the only
 * place anyone will click these.
 */
export const ANCHOR_SCRIPT = `
document.addEventListener('click',function(e){
  var a=e.target.closest('a[href^="#"]');
  if(!a)return;
  var el=document.querySelector(a.getAttribute('href'));
  if(!el)return;
  e.preventDefault();
  el.scrollIntoView({behavior:'smooth',block:'start'});
});`.trim();

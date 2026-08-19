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

export function ipfsToHttp(uri: string, gateway = IPFS_GATEWAYS[0]): string {
  const path = uri.replace(/^ipfs:\/\/(ipfs\/)?/, "");
  if (!/^[A-Za-z0-9]+(\/.*)?$/.test(path)) return "";
  return gateway + path;
}

/** An image src, with the same scheme rules as a link. */
export function safeImage(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith("ipfs://")) return ipfsToHttp(value);
  const url = safeUrl(value);
  return url.startsWith("http") ? url : "";
}

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

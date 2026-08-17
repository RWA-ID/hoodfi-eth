import { BRAND_MARK_DATA_URI } from '../brand-mark'
import { type Env, envVarOptional } from '../env'
import {
  MINT_STATUS,
  normalizeLabel,
  readMintStatus,
  readNameProfile,
} from '../name-profile'

/** Where humans end up. The app is a static export, so it can't serve these tags itself. */
const DEFAULT_SITE = 'https://www.hoodfi.name'

/**
 * Clients that want the tags rather than the destination.
 *
 * Matched first, so a crawler that also looks like a browser — Googlebot is Chrome and
 * does send Sec-Fetch headers — still gets the per-name HTML. A miss here costs a
 * generic card; a false positive costs a person the interstitial, so the list names
 * every previewer we know and keeps the generic suffixes broad.
 */
const BOT_UA =
  /bot|crawl|spider|slurp|preview|embed|scrap|fetch|curl|wget|python-requests|headless|facebookexternalhit|whatsapp|telegram|skype|discord|slack|mastodon|pinterest|vkshare|iframely|quora|applebot/i

/**
 * Is this a person's browser opening the link, rather than something reading its tags?
 *
 * `Sec-Fetch-*` is the positive signal: every current browser sends it on a top-level
 * navigation and essentially no crawler does. Absence therefore fails safe — an old
 * browser or an unknown client gets the HTML, which is why that HTML still has to look
 * like HoodFi.
 */
function isBrowserNavigation(headers: Headers): boolean {
  const ua = headers.get('user-agent') ?? ''
  if (!ua || BOT_UA.test(ua)) return false
  return (
    headers.get('sec-fetch-mode') === 'navigate' ||
    headers.get('sec-fetch-dest') === 'document'
  )
}

/**
 * Hand a browser straight to the app.
 *
 * `no-store` is load-bearing, not caution: this URL now answers differently for a
 * crawler than for a person, and Vercel was caching it (`s-maxage=3600`, observed as
 * `x-vercel-cache: HIT`). A stored crawler variant replayed to a visitor is exactly the
 * black flash this removes, and `Vary` alone is too much to trust a CDN with when the
 * work being cached is one redirect with no chain reads behind it.
 */
function handOff(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      'Cache-Control': 'no-store',
      Vary: 'User-Agent, Sec-Fetch-Mode, Sec-Fetch-Dest',
    },
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Per-name share page.
 *
 * The site ships as a static export, so `/search/?q=gm` serves byte-identical HTML for
 * every name — a crawler reading it can only ever see the generic card, and query
 * strings cannot vary meta tags. This route exists to give each name a URL whose HTML
 * actually describes it, then hand real visitors straight on to the app.
 *
 * Served under the site's own domain via a rewrite, so shared links stay on-brand and
 * crawlers never see a workers.dev URL.
 *
 * A person clicking the link gets a 302 and never sees this page. It used to render an
 * interstitial to every visitor and redirect from script, which painted for a frame or
 * two before the app took over — a shared link opened from X flashed a black card that
 * said "Opening gm.hoodfi.eth…". Only clients that came for the tags render HTML now,
 * and the redirect happens before any chain read, so the hand-off is a header.
 */
export async function getSharePage(
  rawLabel: string,
  request: Request,
  env: Env
): Promise<Response> {
  const site = (envVarOptional('SITE_URL', env) ?? DEFAULT_SITE).replace(/\/$/, '')
  // Card URL prefers the site's own domain — /card/ is rewritten there, so a shared
  // card never exposes a workers.dev address. A rewrite proxies with the worker's Host,
  // so the request origin can't be used for this; it stays as the fallback for direct
  // hits on the worker, where the site rewrite may not exist yet.
  const origin = new URL(request.url).origin
  const cardBase = site || origin
  const label = normalizeLabel(rawLabel)

  if (!label) {
    return handOff(`${site}/search/`)
  }

  const name = `${label}.hoodfi.eth`
  const appUrl = `${site}/search/?q=${encodeURIComponent(label)}`

  if (isBrowserNavigation(request.headers)) {
    return handOff(appUrl)
  }

  const profile = await readNameProfile(label, env)

  // An unregistered name still deserves a real page — the link may be an invitation
  // to mint it — but it gets the generic card, since there is nothing to render. It
  // must not be advertised as available when the registrar would refuse it.
  const status = profile ? null : await readMintStatus(label, env)

  const title = profile
    ? name
    : status === MINT_STATUS.BLOCKED
      ? `${name} is reserved`
      : status === MINT_STATUS.LOCKED
        ? `${name} is a premium name`
        : `${name} is available`

  const description = profile
    ? profile.description ||
      (profile.address
        ? `${name} resolves to ${profile.address.slice(0, 10)}…${profile.address.slice(-8)} — a lifetime ENS name on Robinhood Chain.`
        : `${name} — a lifetime ENS name on Robinhood Chain.`)
    : status === MINT_STATUS.BLOCKED
      ? `${name} is reserved as infrastructure and can't be minted.`
      : status === MINT_STATUS.LOCKED
        ? `Short names unlock once hoodfi.eth's expiry reaches the 100-year goal — or mint one free now with a donation credit.`
        : `Nobody owns ${name} yet. Mint it for life in one transaction on Robinhood Chain.`
  const image = profile ? `${cardBase}/card/${label}.png` : `${site}/og/default.png`

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} · HoodFi.eth</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${escapeHtml(appUrl)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="HoodFi.eth" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(appUrl)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${escapeHtml(title)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@hoodfieth" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
<meta http-equiv="refresh" content="0; url=${escapeHtml(appUrl)}" />
<style>
:root{--paper:#F1F1EA;--ink:#0B0E08;--label:rgba(11,14,8,.55);--dim:rgba(11,14,8,.66);--line:rgba(11,14,8,.18)}
*{box-sizing:border-box}
html,body{margin:0}
body{min-height:100vh;background:var(--paper);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;display:flex;align-items:center;justify-content:center;padding:24px}
.card{border:1px solid var(--line);background:var(--paper);padding:32px;max-width:520px;width:100%}
.mark{display:block;width:36px;height:36px}
.label{margin:20px 0 0;font-family:ui-monospace,"SFMono-Regular",Menlo,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--label)}
.name{margin:8px 0 0;font-size:clamp(28px,7vw,44px);font-weight:600;letter-spacing:-.02em;line-height:1.1;word-break:break-word}
.suffix{color:var(--label)}
.note{margin:20px 0 0;padding-top:20px;border-top:1px solid var(--line);font-size:14px;line-height:1.5;color:var(--dim)}
a{color:var(--ink)}
</style>
</head>
<body>
<div class="card">
<img class="mark" src="${BRAND_MARK_DATA_URI}" alt="HoodFi" width="36" height="36" />
<p class="label">HoodFi Names</p>
<p class="name">${escapeHtml(label)}<span class="suffix">.hoodfi.eth</span></p>
<p class="note"><a href="${escapeHtml(appUrl)}">Continue to ${escapeHtml(name)} &rarr;</a></p>
</div>
<script>location.replace(${JSON.stringify(appUrl)});</script>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Not shared-cacheable, and Vary declared: see handOff() — a cached copy of this
      // variant served to a person is the flash coming back.
      'Cache-Control': 'no-store',
      Vary: 'User-Agent, Sec-Fetch-Mode, Sec-Fetch-Dest',
    },
  })
}

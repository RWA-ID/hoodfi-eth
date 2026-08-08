import { type Env, envVarOptional } from '../env'
import {
  MINT_STATUS,
  normalizeLabel,
  readMintStatus,
  readNameProfile,
} from '../name-profile'

/** Where humans end up. The app is a static export, so it can't serve these tags itself. */
const DEFAULT_SITE = 'https://www.hoodfi.name'

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
 */
export async function getSharePage(
  rawLabel: string,
  requestUrl: string,
  env: Env
): Promise<Response> {
  const site = (envVarOptional('SITE_URL', env) ?? DEFAULT_SITE).replace(/\/$/, '')
  // The card is addressed relative to however this page was reached, so it resolves
  // whether the request arrived through the site's rewrite or straight at the worker.
  // Pinning it to SITE_URL would 404 until the rewrite is deployed.
  const origin = new URL(requestUrl).origin
  const label = normalizeLabel(rawLabel)

  if (!label) {
    return Response.redirect(`${site}/search/`, 302)
  }

  const profile = await readNameProfile(label, env)
  const name = `${label}.hoodfi.eth`
  const appUrl = `${site}/search/?q=${encodeURIComponent(label)}`

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
  const image = profile ? `${origin}/card/${label}.png` : `${site}/og/default.png`

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
<style>body{background:#0a0f0c;color:#e9f2ea;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}a{color:#00c805}</style>
</head>
<body>
<p>Opening <a href="${escapeHtml(appUrl)}">${escapeHtml(name)}</a>…</p>
<script>location.replace(${JSON.stringify(appUrl)});</script>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  })
}

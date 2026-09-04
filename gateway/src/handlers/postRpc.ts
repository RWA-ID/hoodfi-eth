import { DEFAULT_ROBINHOOD_RPC, FALLBACK_ROBINHOOD_RPC } from '../chains'
import { type Env, envVarOptional } from '../env'

/**
 * Browser-side JSON-RPC proxy for Robinhood Chain.
 *
 * Exists because the chain's own RPC cannot be called from a browser at all. On POST it
 * answers with
 *
 *   access-control-allow-origin: *,*
 *
 * Two layers each append `*`, and a list is not a legal value, so every browser rejects
 * the response. The preflight is clean — OPTIONS returns a single `*` — so it passes CORS
 * and then fails on the real call, which is why it reads as an unrelated wallet fault:
 * measured 12/12 on 2026-09-04, the same from desktop and mobile, while `curl` (which
 * does not enforce CORS) succeeded every time and `eth_chainId` returned 0x1237.
 *
 * It took down far more than it looked like. Every browser read through l2Client, every
 * chain switch, every mint. The visible symptom was our own message telling people to
 * "add Robinhood Chain manually (chain id 4663)" — advice that could not work, aimed at
 * a wallet that was never the problem.
 *
 * Server-to-server has no CORS, so forwarding the call from here and answering with one
 * clean header is the whole fix. Remove this once the upstream header is corrected;
 * nothing else about it is worth keeping.
 */

/** The upstream response's own CORS headers are the bug. Only these are carried over. */
const SAFE_RESPONSE_HEADERS = ['content-type']

/** A JSON-RPC envelope is small. Anything larger is not a call we serve. */
const MAX_BODY_BYTES = 128 * 1024

/**
 * Origins allowed to spend this worker's RPC budget.
 *
 * Not a security boundary — `Origin` is trivially forged outside a browser, and the
 * upstream is public anyway. It is a spend control: the first endpoint tried is the
 * dedicated keyed one, and without this every visitor to any site could bill their
 * traffic to that key. Browsers always send Origin on a cross-origin POST, so honest
 * callers are unaffected.
 */
const ALLOWED_ORIGINS = [
  'https://hoodfi.name',
  'https://www.hoodfi.name',
  'https://build.hoodfi.name',
  'https://hoodfi.eth.limo',
  'https://hoodfi.eth.link',
]

function originAllowed(origin: string | null): boolean {
  if (!origin) return true // same-origin and server-side callers send none
  if (ALLOWED_ORIGINS.includes(origin)) return true
  // Local development, any port.
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
}

export async function postRpc(request: Request, env: Env): Promise<Response> {
  if (!originAllowed(request.headers.get('origin'))) {
    return Response.json({ error: 'Origin not allowed' }, { status: 403 })
  }

  const body = await request.text()
  if (body.length > MAX_BODY_BYTES) {
    return Response.json({ error: 'Request too large' }, { status: 413 })
  }
  // Parsed only to reject junk before spending an upstream call; the original text is
  // what gets forwarded, so batch calls and unknown methods pass through untouched.
  try {
    JSON.parse(body)
  } catch {
    return Response.json({ error: 'Expected a JSON-RPC body' }, { status: 400 })
  }

  const dedicated = envVarOptional('ROBINHOOD_RPC_URL', env)
  const urls = [dedicated, DEFAULT_ROBINHOOD_RPC, FALLBACK_ROBINHOOD_RPC].filter(
    (url): url is string => Boolean(url)
  )

  let lastStatus = 502
  for (const url of urls) {
    let upstream: Response
    try {
      upstream = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      continue // network error or timeout — try the next endpoint
    }

    // 429 and 5xx are the shared-egress rate limit this worker is known to collect.
    // Anything else, including a JSON-RPC error, is a real answer and belongs to the
    // caller: a revert is not a reason to retry against another endpoint.
    if (upstream.status === 429 || upstream.status >= 500) {
      lastStatus = upstream.status
      continue
    }

    const headers = new Headers()
    for (const name of SAFE_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    // Deliberately a new Response rather than a passthrough. Returning `upstream`
    // directly would carry its `access-control-allow-origin: *,*` straight to the
    // browser and reproduce the exact bug this exists to route around.
    return new Response(upstream.body, { status: upstream.status, headers })
  }

  // Never echo the upstream URL: the first entry carries an API key, and a raw error
  // is how a keyed endpoint ends up in someone's console.
  return Response.json({ error: 'Upstream RPC unavailable' }, { status: lastStatus })
}

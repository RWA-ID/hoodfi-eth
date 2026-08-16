import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { type Env } from './env'
import { getCcipRead, getHealth } from './handlers/getCcipRead'
import { getDonations } from './handlers/getDonations'
import { getNameCard } from './handlers/getNameCard'
import { getSharePage } from './handlers/getSharePage'
import { getTokenArt } from './handlers/getTokenArt'
import { getTokenMetadata } from './handlers/getTokenMetadata'
import { getVoucher } from './handlers/getVoucher'
import { postAvatar } from './handlers/postAvatar'
import { postEvent } from './handlers/postEvent'
import { postPartner } from './handlers/postPartner'

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors())
app.get('/', async (c) => c.json({ status: 'ok' }))
app.get('/health', async (c) => getHealth(c.env))

// Primary: EIP-3668 templated GET form — url/{sender}/{data}.json
app.get('/v1/:sender/:data', async (c) =>
  getCcipRead(c.req.param('sender'), c.req.param('data'), c.env)
)

// Fallback: EIP-3668 POST form (clients POST {sender,data} when the url template
// has no placeholders — ours does, but robust gateways serve both)
app.post('/v1', async (c) => {
  const body = await c.req.json<{ sender?: string; data?: string }>().catch(() => null)
  if (!body?.sender || !body?.data) {
    return c.json({ message: 'Expected JSON body with sender and data' }, 400)
  }
  return getCcipRead(body.sender, body.data, c.env)
})

// ERC-721 metadata — the registry's baseURI points here, so marketplaces fetch
// `/nft/{tokenId}`. Some indexers append `.json`; accept both spellings.
app.get('/nft/:tokenId', async (c) =>
  getTokenMetadata(c.req.param('tokenId').replace(/\.json$/, ''), c.req.url, c.env)
)

// The image that metadata points at, rendered per name — the name itself on lime.
app.get('/art/:label', async (c) => getTokenArt(c.req.param('label'), c.env))

// Short-name credit voucher. Attests mainnet donation credits so HoodfiRegistrar on
// Robinhood Chain can let a donor mint a 1-3 char name without a bridge.
app.get('/voucher/:address', async (c) => getVoucher(c.req.param('address'), c.env))

// Per-name share link. A static export serves identical HTML for every name, so this
// is the only place a crawler can be told what `gm.hoodfi.eth` actually is. Rewritten
// onto the site's own domain, so shared URLs never expose workers.dev.
app.get('/n/:label', async (c) => getSharePage(c.req.param('label'), c.req.url, c.env))

// The 1200x630 image those tags point at, rendered per name.
app.get('/card/:label', async (c) => getNameCard(c.req.param('label'), c.env))

// Avatar image hosting. ENS records store a URL, so without somewhere to put a file
// only people who already host images can set one. Authorised by a signature from the
// name's owner, never by trusting the caller.
app.post('/avatar/:label', async (c) => postAvatar(c.req.param('label'), c.req.raw, c.env))

// Donation ledger. Proxied because a wide eth_getLogs needs an archive endpoint, and
// the browser can only be given one by publishing the key in the bundle.
app.get('/donations', async (c) => getDonations(c.env))

// Cookieless analytics sink. Always 204s — the site must never break on a bad beacon.
app.post('/e', async (c) => postEvent(c.req.raw, c.env))

// Partner enquiry intake. A static export has nowhere to post a form, so this is the
// only path from /partner/ to an inbox. Delivers to one fixed address, never a
// caller-supplied one — see the handler for why that constraint is the whole design.
app.post('/partner', async (c) => postPartner(c.req.raw, c.env))

export default app

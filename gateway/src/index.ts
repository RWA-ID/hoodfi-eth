import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { type Env } from './env'
import { getCcipRead, getHealth } from './handlers/getCcipRead'
import { getTokenMetadata } from './handlers/getTokenMetadata'

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
  getTokenMetadata(c.req.param('tokenId').replace(/\.json$/, ''), c.env)
)

export default app

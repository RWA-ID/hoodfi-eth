import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { ROBINHOOD_CHAIN_ID } from './chain'
import type { Env } from './env'
import { SERVER_INFO, handleMcpPost, parseError } from './mcp'
import { TOOLS } from './tools'

const app = new Hono<{ Bindings: Env }>()

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['content-type', 'mcp-protocol-version', 'mcp-session-id'],
    exposeHeaders: ['mcp-session-id'],
    maxAge: 86_400,
  })
)

/**
 * The HoodFi H, for clients that take a connector's icon from the server's domain.
 * Proxied from the site so there is one copy of the artwork.
 */
app.get('/favicon.ico', async () => {
  const icon = await fetch('https://www.hoodfi.name/favicon.ico', {
    cf: { cacheTtl: 86_400, cacheEverything: true },
  })
  return new Response(icon.body, {
    status: icon.status,
    headers: { 'content-type': 'image/x-icon', 'cache-control': 'public, max-age=86400' },
  })
})
app.get('/icon.png', async () => {
  const icon = await fetch('https://www.hoodfi.name/icon-512.png', {
    cf: { cacheTtl: 86_400, cacheEverything: true },
  })
  return new Response(icon.body, {
    status: icon.status,
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' },
  })
})

/**
 * A plain description of the endpoint. A browser is sent to the human page instead,
 * which also gives favicon crawlers a page carrying the H.
 */
app.get('/', (c) =>
  (c.req.header('accept') ?? '').includes('text/html')
    ? c.redirect('https://www.hoodfi.name/mcp', 302)
    : c.json({
    ...SERVER_INFO,
    transport: 'streamable-http',
    endpoint: new URL('/mcp', c.req.url).toString(),
    chainId: ROBINHOOD_CHAIN_ID,
    tools: TOOLS.map((tool) => tool.name),
    docs: 'https://www.hoodfi.name',
  })
)

app.post('/mcp', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return parseError()
  }
  return handleMcpPost(body, c.env)
})

/**
 * Streamable HTTP lets a server offer a GET stream for server-initiated messages.
 * This one is stateless and never initiates anything, so the spec's advice is to say
 * so plainly rather than hold a socket open that will never carry a message.
 */
app.get('/mcp', (c) =>
  c.text('This MCP server is stateless; no event stream.', 405)
)
app.delete('/mcp', (c) =>
  c.text('This MCP server issues no sessions to terminate.', 405)
)

export default app

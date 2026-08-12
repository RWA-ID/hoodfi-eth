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

/** A plain description of the endpoint, for anyone who opens the URL in a browser. */
app.get('/', (c) =>
  c.json({
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

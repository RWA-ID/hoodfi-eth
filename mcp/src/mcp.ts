import type { Env } from './env'
import { TOOLS, callTool } from './tools'

/**
 * A stateless MCP server over Streamable HTTP.
 *
 * Every tool here is a read plus some calldata encoding, so there is nothing to keep
 * between calls: each POST is answered on its own and no session is issued. That is
 * what lets this run on a plain Worker with no Durable Object behind it — the
 * stateful transport would need somewhere to park an SSE stream per client.
 *
 * The protocol is small enough at this size that speaking JSON-RPC directly is less
 * code than adapting a Node-shaped SDK transport onto Workers, and it removes a whole
 * class of runtime-compat surprises.
 */

export const SERVER_INFO = {
  name: 'hoodfi',
  title: 'HoodFi — ENS names on Robinhood Chain',
  version: '1.0.0',
}

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0] as string

const INSTRUCTIONS = [
  'HoodFi issues ENS names under hoodfi.eth as lifetime ERC-721s on Robinhood Chain (chain id 4663).',
  '',
  'This server holds no private keys and never broadcasts a transaction. It answers questions and returns unsigned calldata; the caller signs and submits it.',
  '',
  'Three rules to hold on to:',
  '- The registrar mints to the transaction sender. Whichever wallet signs owns the name. There is no recipient argument, so a name cannot be registered on behalf of another address.',
  '- Only names of 4 or more characters can be registered. Names of 1-3 characters are premium inventory reserved for donors holding short-name credits, and stay unavailable until the 100-year donation goal is reached.',
  '- A name can carry Ethereum, Bitcoin and Solana addresses. These are payment records: before relaying one as somewhere to send funds, note that only Bitcoin is checksummed. A Solana address has no checksum at all, so a mistyped one is indistinguishable from a correct one, and an Ethereum address is only verified when it carries EIP-55 capitalisation. hoodfi_build_set_address_tx returns a "verify" field whenever that applies; pass it on rather than reporting the address as validated.',
].join('\n')

type JsonRpcId = string | number | null

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: JsonRpcId
  method: string
  params?: Record<string, unknown>
}

const PARSE_ERROR = -32700
const INVALID_REQUEST = -32600
const METHOD_NOT_FOUND = -32601
const INVALID_PARAMS = -32602

function result(id: JsonRpcId, value: unknown) {
  return { jsonrpc: '2.0' as const, id, result: value }
}

function failure(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: '2.0' as const, id, error: { code, message } }
}

async function handleOne(
  request: JsonRpcRequest,
  env: Env
): Promise<object | undefined> {
  const { method, params } = request
  // A JSON-RPC notification carries no id and must not be answered.
  const isNotification = request.id === undefined
  const id = request.id ?? null

  if (isNotification) {
    // `notifications/initialized` and friends need no reply; anything else unknown
    // is still a notification, so it is still silently accepted.
    return undefined
  }

  switch (method) {
    case 'initialize': {
      const requested = params?.protocolVersion
      const protocolVersion =
        typeof requested === 'string' &&
        SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
          ? requested
          : LATEST_PROTOCOL_VERSION

      return result(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      })
    }

    case 'ping':
      return result(id, {})

    case 'tools/list':
      return result(id, { tools: TOOLS })

    case 'tools/call': {
      const name = params?.name
      if (typeof name !== 'string')
        return failure(id, INVALID_PARAMS, '`name` is required')

      const rawArgs = params?.arguments
      const args =
        rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
          ? (rawArgs as Record<string, unknown>)
          : {}

      const { text, isError } = await callTool(name, args, env)
      return result(id, { content: [{ type: 'text', text }], isError })
    }

    default:
      return failure(id, METHOD_NOT_FOUND, `Unknown method: ${method}`)
  }
}

function isValidRequest(value: unknown): value is JsonRpcRequest {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return candidate.jsonrpc === '2.0' && typeof candidate.method === 'string'
}

export async function handleMcpPost(
  body: unknown,
  env: Env
): Promise<Response> {
  // Batches were dropped in protocol 2025-06-18 but older clients still send them,
  // and answering one is no harder than answering a single call.
  if (Array.isArray(body)) {
    if (body.length === 0)
      return json(failure(null, INVALID_REQUEST, 'Empty batch'), 400)

    const responses: object[] = []
    for (const entry of body) {
      if (!isValidRequest(entry)) {
        responses.push(
          failure(null, INVALID_REQUEST, 'Not a JSON-RPC 2.0 request')
        )
        continue
      }
      const response = await handleOne(entry, env)
      if (response) responses.push(response)
    }
    // An all-notification batch gets the same empty acknowledgement a single one does.
    if (responses.length === 0) return new Response(null, { status: 202 })
    return json(responses, 200)
  }

  if (!isValidRequest(body))
    return json(
      failure(null, INVALID_REQUEST, 'Not a JSON-RPC 2.0 request'),
      400
    )

  const response = await handleOne(body, env)
  if (!response) return new Response(null, { status: 202 })
  return json(response, 200)
}

export function parseError(): Response {
  return json(failure(null, PARSE_ERROR, 'Invalid JSON'), 400)
}

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

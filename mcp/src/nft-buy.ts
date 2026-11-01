import { type Address, type Hex, encodeFunctionData, formatEther, getAddress, isAddress } from 'viem'

import { finish, requireAddress } from './agent-tools'
import { ROBINHOOD_CHAIN_ID, robinhoodClient } from './chain'
import { type Env, envVarOptional } from './env'
import { ToolError } from './errors'
import { SEAPORT, SEAPORT_FUNCTION, seaportAbi } from './nft-relay'

/**
 * Buying an NFT on Robinhood Chain from its OpenSea listing. The user pastes the OpenSea
 * URL into the panel, sees the NFT and the price, and confirms; PayBox then signs.
 *
 * Scope: one item, a basic Seaport order, paid in ETH. Anything else is refused and sent
 * to OpenSea. HoodFi adds no fee and never holds funds.
 *
 * OpenSea supplies the order but is not trusted for what it means. Before anything is
 * returned for signing the order is checked against what the user confirmed: this token,
 * at or under this price, on the real Seaport contract. As with sending, a token's name
 * and art go only to the iframe (GET /listing), never into a tool result.
 */

const API = 'https://api.opensea.io/api/v2'
const CHAIN = 'robinhood'
const ZERO = '0x0000000000000000000000000000000000000000'
const DOWN = 'Could not reach OpenSea right now: the request failed, which says nothing about the listing. Try again shortly.'
const UNREADABLE = 'Could not read Robinhood Chain right now: the read failed rather than coming back empty. Try again shortly.'

export const BUY_TOOLS = [
  {
    name: 'hoodfi_buy_nft',
    title: 'Buy an NFT from its OpenSea link',
    description:
      'Open the HoodFi buy panel for the PayBox wallet (PayBox list_credentials). The user pastes the OpenSea URL of an NFT on Robinhood Chain, checks the NFT and price, and presses Buy. Robinhood Chain listings priced in ETH only. Pass `url` if the user already gave the link. Then wait for them to press Buy; never build a purchase they have not confirmed.',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'The wallet that pays and receives the NFT, 0x…' },
        url: { type: 'string', description: 'Optional: the OpenSea URL the user gave.' },
      },
      required: ['address'],
      additionalProperties: false,
    },
  },
  {
    name: 'hoodfi_build_nft_purchase_tx',
    title: 'Buy an NFT',
    description:
      'Build the transaction that buys an NFT from the OpenSea listing the user confirmed in the buy panel; the panel\'s message gives every argument. Refused if the listing no longer matches, costs more than max_price_wei, has expired, or would fail on chain. The NFT goes to the signing wallet. IRREVERSIBLE: state the price before signing. Sign with PayBox and broadcast with hoodfi_send_transaction.',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'The buying wallet, which signs.' },
        contract: { type: 'string', description: 'The NFT contract, 0x…' },
        token_id: { type: 'string', description: 'The token id, as a decimal string.' },
        order_hash: { type: 'string', description: 'The listing the user confirmed, 0x…' },
        max_price_wei: { type: 'string', description: 'The price the user confirmed, in wei. The purchase is refused above it.' },
        from_panel: { type: 'boolean', description: "True when the user pressed Buy in the panel; the panel's message says so." },
      },
      required: ['address', 'contract', 'token_id', 'order_hash', 'max_price_wei'],
      additionalProperties: false,
    },
  },
] as const

/* ------------------------------------------------------------- OpenSea */

/** null = OpenSea answered that there is no such thing. A failure throws: it is not "not listed". */
async function os(env: Env, path: string, body?: unknown): Promise<any | null> {
  const key = envVarOptional('OPENSEA_API_KEY', env)
  if (!key) throw new ToolError(DOWN)
  const request = () =>
    fetch(`${API}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'x-api-key': key, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10_000),
    })
  let res: Response
  try {
    res = await request()
    // One shared key: a burst gets throttled, so a lookup survives a brief 429 once.
    if (res.status === 429 || res.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 1_200))
      res = await request()
    }
  } catch {
    throw new ToolError(DOWN)
  }
  if (res.status === 404 || res.status === 400) return null
  if (!res.ok) throw new ToolError(DOWN)
  try {
    return await res.json()
  } catch {
    throw new ToolError(DOWN)
  }
}

/** Both URL shapes OpenSea serves: /assets/{chain}/{contract}/{id} and /item/{chain}/{contract}/{id}. */
export function parseOpenSeaUrl(input: unknown): { contract: Address; tokenId: string } {
  const bad = 'Paste the link to one NFT from opensea.io, like https://opensea.io/item/robinhood/0x…/123.'
  if (typeof input !== 'string') throw new ToolError(bad)
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new ToolError(bad)
  }
  if (url.protocol !== 'https:' || !/^(www\.)?opensea\.io$/.test(url.hostname)) throw new ToolError(bad)
  const parts = url.pathname.split('/').filter(Boolean)
  // A language prefix (/de/item/…) is allowed: find the marker rather than index from 0.
  const at = parts.findIndex((p) => p === 'assets' || p === 'item')
  const [chain, contract, tokenId] = at < 0 ? [] : parts.slice(at + 1)
  if (!chain || !contract || !tokenId) throw new ToolError(bad)
  if (chain !== CHAIN) throw new ToolError(`That NFT is on ${chain.slice(0, 30)}. Only Robinhood Chain NFTs can be bought here.`)
  if (!isAddress(contract, { strict: false }) || !/^\d{1,78}$/.test(tokenId)) throw new ToolError(bad)
  return { contract: getAddress(contract), tokenId }
}

/** For GET /listing: what the buy panel draws. Not for tool results; see the top of this file. */
export async function listingForPanel(rawUrl: string | undefined, env: Env) {
  const { contract, tokenId } = parseOpenSeaUrl(rawUrl)
  const nftBody = await os(env, `/chain/${CHAIN}/contract/${contract}/nfts/${tokenId}`)
  const nft = nftBody?.nft
  if (!nft) throw new ToolError('OpenSea has no such NFT on Robinhood Chain. Check the link.')
  const slug = encodeURIComponent(String(nft.collection ?? ''))
  const [best, collection] = await Promise.all([
    os(env, `/listings/collection/${slug}/nfts/${tokenId}/best`),
    os(env, `/collections/${slug}`),
  ])
  const raw = nft.display_image_url || nft.image_url
  let image: string | null = null
  try {
    const u = new URL(raw)
    if (!nft.is_nsfw && u.protocol === 'https:' && u.hostname.endsWith('.seadn.io')) image = u.toString()
  } catch {}
  const view = {
    contract,
    tokenId,
    name: String(nft.name ?? '').slice(0, 80),
    collection: String(collection?.name ?? nft.collection ?? '').slice(0, 60),
    verified: ['verified', 'approved'].includes(String(collection?.safelist_status)),
    image,
    url: `https://opensea.io/assets/${CHAIN}/${contract}/${tokenId}`,
  }
  const price = best?.price?.current
  if (!best?.order_hash || !price) return { ...view, listed: false as const, reason: 'This NFT is not listed for sale.' }
  if (price.currency !== 'ETH' || best.type !== 'basic' || best.protocol_address?.toLowerCase() !== SEAPORT.toLowerCase())
    return { ...view, listed: false as const, reason: 'This listing is not a plain ETH sale, so it can only be bought on OpenSea.' }
  const wei = BigInt(price.value)
  return {
    ...view,
    listed: true as const,
    orderHash: String(best.order_hash),
    priceWei: wei.toString(),
    priceEth: formatEther(wei),
    seller: String(best.protocol_data?.parameters?.offerer ?? ''),
    endTime: Number(best.protocol_data?.parameters?.endTime ?? 0),
  }
}

/* ------------------------------------------------------------- tools */

export function openBuyPanel(args: Record<string, unknown>) {
  const address = requireAddress(args.address)
  let url: string | null = null
  if (args.url) {
    const { contract, tokenId } = parseOpenSeaUrl(args.url)
    url = `https://opensea.io/assets/${CHAIN}/${contract}/${tokenId}`
  }
  return {
    address,
    url,
    buy: { address, url },
    next_step: 'The panel shows the NFT and its price. Wait for the user to press Buy, then follow the message it posts. If the panel did not appear, this client cannot show it: send the user to the listing on OpenSea.',
  }
}

export async function buildNftPurchaseTx(args: Record<string, unknown>, env: Env) {
  const address = requireAddress(args.address)
  const contract = requireAddress(args.contract, 'contract')
  const tokenId = typeof args.token_id === 'string' && /^\d{1,78}$/.test(args.token_id) ? args.token_id : null
  if (!tokenId) throw new ToolError('`token_id` must be a decimal string.')
  const orderHash = typeof args.order_hash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(args.order_hash) ? args.order_hash : null
  if (!orderHash) throw new ToolError('`order_hash` must be the listing hash from the buy panel.')
  const maxPrice = typeof args.max_price_wei === 'string' && /^\d{1,40}$/.test(args.max_price_wei) ? BigInt(args.max_price_wei) : null
  if (maxPrice === null) throw new ToolError('`max_price_wei` must be the confirmed price in wei, as a decimal string.')

  const gone = 'That listing can no longer be filled: it sold, was cancelled or expired. Look the NFT up again in the buy panel.'
  const body = await os(env, '/listings/fulfillment_data', {
    listing: { hash: orderHash, chain: CHAIN, protocol_address: SEAPORT.toLowerCase() },
    fulfiller: { address },
  })
  const tx = body?.fulfillment_data?.transaction
  if (!tx) throw new ToolError(gone)
  const p = tx.input_data?.parameters
  const unsupported = 'This listing is not a plain single-item ETH sale, so it can only be bought on OpenSea.'
  if (tx.function !== SEAPORT_FUNCTION || !p) throw new ToolError(unsupported)
  if (String(tx.to).toLowerCase() !== SEAPORT.toLowerCase() || Number(tx.chain) !== ROBINHOOD_CHAIN_ID)
    throw new ToolError('OpenSea returned a transaction for another contract or chain. Refusing to build it.')

  // What the order actually does, re-derived from the order itself.
  const additional = (p.additionalRecipients ?? []) as { amount: string; recipient: string }[]
  const total = additional.reduce((sum, r) => sum + BigInt(r.amount), BigInt(p.considerationAmount))
  if (p.considerationToken !== ZERO || Number(p.basicOrderType) >= 8 || BigInt(p.offerAmount) !== 1n) throw new ToolError(unsupported)
  if (getAddress(p.offerToken) !== contract || BigInt(p.offerIdentifier) !== BigInt(tokenId))
    throw new ToolError('That listing is for a different NFT than the one confirmed. Refusing to build it.')
  if (BigInt(tx.value) !== total) throw new ToolError('OpenSea\'s price and the order\'s own amounts disagree. Refusing to build it.')
  if (total > maxPrice)
    throw new ToolError(`The price is now ${formatEther(total)} ETH, above the ${formatEther(maxPrice)} ETH you confirmed. Look it up again in the buy panel.`)
  if (BigInt(p.endTime) * 1000n <= BigInt(Date.now())) throw new ToolError(gone)
  const seller = getAddress(p.offerer)
  if (seller === address) throw new ToolError('This wallet is the seller of that listing.')

  const encoded = encodeFunctionData({
    abi: seaportAbi,
    functionName: 'fulfillBasicOrder_efficient_6GL6yc',
    args: [
      {
        considerationToken: getAddress(p.considerationToken),
        considerationIdentifier: BigInt(p.considerationIdentifier),
        considerationAmount: BigInt(p.considerationAmount),
        offerer: seller,
        zone: getAddress(p.zone),
        offerToken: contract,
        offerIdentifier: BigInt(p.offerIdentifier),
        offerAmount: 1n,
        basicOrderType: Number(p.basicOrderType),
        startTime: BigInt(p.startTime),
        endTime: BigInt(p.endTime),
        zoneHash: p.zoneHash,
        salt: BigInt(p.salt),
        offererConduitKey: p.offererConduitKey,
        fulfillerConduitKey: p.fulfillerConduitKey,
        totalOriginalAdditionalRecipients: BigInt(p.totalOriginalAdditionalRecipients),
        additionalRecipients: additional.map((r) => ({ amount: BigInt(r.amount), recipient: getAddress(r.recipient) })),
        signature: p.signature,
      },
    ],
  })
  // OpenSea's attribution tag, ignored by Seaport.
  const suffix = /^0x([0-9a-fA-F]{2})*$/.test(String(tx.calldata_suffix ?? '')) ? String(tx.calldata_suffix).slice(2) : ''
  const data = `${encoded}${suffix}` as Hex

  const client = robinhoodClient(env)
  let balance: bigint
  try {
    balance = await client.getBalance({ address })
  } catch {
    throw new ToolError(UNREADABLE)
  }
  if (balance < total)
    throw new ToolError(`${address} holds ${formatEther(balance)} ETH on Robinhood Chain and this costs ${formatEther(total)} ETH plus gas. Fund the wallet first.`)

  const warnings = ['Purchases are irreversible. HoodFi adds no fee and does not vouch for this NFT or its collection.']
  try {
    await client.call({ account: address, to: SEAPORT, data, value: total })
  } catch (error) {
    const detail = error instanceof Error ? `${(error as { details?: string }).details ?? ''} ${error.message.split('\n')[0]}` : ''
    if (/revert/i.test(detail)) throw new ToolError(gone)
    warnings.push("Couldn't simulate this purchase first, so it isn't known yet whether it will succeed.")
  }

  const price = `${formatEther(total)} ETH`
  const short = tokenId.length > 12 ? `${tokenId.slice(0, 6)}…${tokenId.slice(-4)}` : tokenId
  const result = await finish(
    env,
    address,
    {
      contract,
      token_id: tokenId,
      order_hash: orderHash,
      price_wei: total.toString(),
      price_eth: formatEther(total),
      seller,
      steps: [
        {
          description: `Buy token ${tokenId} of ${contract} for ${price}`,
          to: SEAPORT,
          data,
          value: `0x${total.toString(16)}`,
          chainId: ROBINHOOD_CHAIN_ID,
        },
      ],
      warnings,
    },
    {
      action: 'buy-nft',
      name: `NFT #${short}`,
      rows: [
        ['Collection', contract],
        ['Seller', seller],
        ['You pay', price],
      ],
      warnings,
      url: `https://opensea.io/assets/${CHAIN}/${contract}/${tokenId}`,
    }
  )
  return args.from_panel === true ? { ...result, card: { ...result.card, handoff: true } } : result
}

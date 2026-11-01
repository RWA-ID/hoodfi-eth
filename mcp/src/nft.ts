import { type Address, type Hex, encodeFunctionData, getAddress, isAddress, namehash } from 'viem'

import { MAX_LABEL_LENGTH, PARENT } from './labels'
import { finish, requireAddress, requireHoodfiName } from './agent-tools'
import { ETH_COIN_TYPE, ROBINHOOD_CHAIN_ID, ROBINHOOD_COIN_TYPE, robinhoodClient } from './chain'
import { COINS } from './coins'
import { registryAbi } from './contracts'
import { type Env, envVar, envVarOptional } from './env'
import { ToolError } from './errors'
import { nftAbi } from './nft-relay'
import { isListableName } from './owned-names'

/**
 * Sending an NFT on Robinhood Chain. Send only, Robinhood Chain only.
 *
 * OpenSea is the index: it decides what the picker shows and nothing else. Anyone can
 * airdrop a token into a wallet and name it anything, so:
 *  - names, collections and images go straight from GET /nfts/:address to the picker
 *    iframe, which writes them with textContent. They never enter a tool result, because
 *    a tool result is read by the model.
 *  - the transaction is built from what the chain says (standard, ownership), never
 *    from what the index says.
 */

const UNREADABLE =
  'Could not read Robinhood Chain right now: the read failed rather than coming back empty, so this says nothing either way. Try again shortly.'
const INDEX_DOWN =
  'Could not read this wallet\'s NFTs from OpenSea right now: the request failed, which does not mean the wallet holds none. Try again shortly.'

const ZERO = '0x0000000000000000000000000000000000000000'
const ERC721_ID = '0x80ac58cd'
const ERC1155_ID = '0xd9b67a26'
const OPENSEA_CHAIN = 'robinhood'
const PAGE_SIZE = 50

export const NFT_TOOLS = [
  {
    name: 'hoodfi_list_nfts',
    title: 'Pick an NFT to send',
    description:
      "Show the NFTs a wallet holds on Robinhood Chain in a HoodFi picker, where the user selects one, enters a recipient and presses Send. Use the PayBox wallet (PayBox list_credentials) as the address. Robinhood Chain only. Returns contract and token id for each; names and images appear only in the picker because a stranger can airdrop a token with any text in it. Call this when the user wants to send an NFT and hasn't given the exact contract and token id.",
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'The wallet holding the NFTs, 0x…' },
        cursor: { type: 'string', description: 'Optional: `next` from an earlier call, for the next page.' },
      },
      required: ['address'],
      additionalProperties: false,
    },
  },
  {
    name: 'hoodfi_build_nft_transfer_tx',
    title: 'Send an NFT',
    description:
      'Build the transaction that sends an ERC-721 or ERC-1155 NFT on Robinhood Chain from the wallet to a recipient (0x… or a hoodfi.eth name, whose Robinhood Chain address is read from the registry; other .eth names are refused). Ownership and token standard are checked on chain. IRREVERSIBLE: tell the user the resolved recipient address before signing. Then sign the step with PayBox and broadcast with hoodfi_send_transaction.',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'The wallet holding the NFT, which signs.' },
        contract: { type: 'string', description: 'The NFT contract, 0x…' },
        token_id: { type: 'string', description: 'The token id, as a decimal string.' },
        to: { type: 'string', description: 'The recipient: 0x… or a hoodfi name ("gm" or "jack.gm.hoodfi.eth").' },
        quantity: { type: 'string', description: 'ERC-1155 only: how many to send. Default 1.' },
        from_picker: { type: 'boolean', description: "True when the user pressed Send in the HoodFi NFT picker; the picker's message says so." },
      },
      required: ['address', 'contract', 'token_id', 'to'],
      additionalProperties: false,
    },
  },
] as const

/* ------------------------------------------------------------- the index */

interface OpenSeaNft {
  identifier: string
  collection?: string
  contract: string
  token_standard?: string
  name?: string | null
  display_image_url?: string | null
  image_url?: string | null
  opensea_url?: string
  is_disabled?: boolean
  is_nsfw?: boolean
  quantity?: string | number
  quantity_string?: string
}

async function fetchPage(env: Env, address: Address, cursor?: string) {
  const key = envVarOptional('OPENSEA_API_KEY', env)
  if (!key) throw new ToolError(INDEX_DOWN)
  const url = new URL(`https://api.opensea.io/api/v2/chain/${OPENSEA_CHAIN}/account/${address}/nfts`)
  url.searchParams.set('limit', String(PAGE_SIZE))
  if (cursor) url.searchParams.set('next', cursor)
  let body: { nfts?: OpenSeaNft[]; next?: string | null }
  try {
    const res = await fetch(url, {
      headers: { 'x-api-key': key, accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
      // A short edge cache: the picker is an unauthenticated route on a shared API key.
      ...({ cf: { cacheTtl: 20, cacheEverything: true } } as object),
    })
    if (!res.ok) throw new Error('status')
    body = (await res.json()) as typeof body
    if (!Array.isArray(body.nfts)) throw new Error('shape')
  } catch {
    // Never an empty list: a throttle must not read as "you hold nothing".
    throw new ToolError(INDEX_DOWN)
  }
  return {
    nfts: body.nfts.filter(
      (n) => !n.is_disabled && isAddress(n.contract, { strict: false }) && /^\d+$/.test(n.identifier)
    ),
    next: body.next || null,
  }
}

const quantityOf = (n: OpenSeaNft) => String(n.quantity_string ?? n.quantity ?? '1')
const isErc1155 = (n: OpenSeaNft) => n.token_standard?.toLowerCase() === 'erc1155'

function requireCursor(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/=_-]{1,512}$/.test(value))
    throw new ToolError('`cursor` must be the `next` value from an earlier call.')
  return value
}

/** OpenSea's own CDN only; the iframe's CSP allows nothing else. */
function safeImage(n: OpenSeaNft): string | null {
  const raw = n.display_image_url || n.image_url
  if (!raw) return null
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && u.hostname.endsWith('.seadn.io') ? u.toString() : null
  } catch {
    return null
  }
}

/** For GET /nfts/:address: what the picker draws. Not for tool results; see the top of this file. */
export async function nftsForPicker(rawAddress: string, rawCursor: string | undefined, env: Env) {
  const address = requireAddress(rawAddress)
  const { nfts, next } = await fetchPage(env, address, requireCursor(rawCursor))
  return {
    address,
    next,
    nfts: nfts.map((n) => ({
      contract: getAddress(n.contract),
      tokenId: n.identifier,
      erc1155: isErc1155(n),
      quantity: quantityOf(n),
      name: (n.name ?? '').slice(0, 80),
      collection: (n.collection ?? '').slice(0, 60),
      image: n.is_nsfw ? null : safeImage(n),
      hidden: Boolean(n.is_nsfw),
      url: `https://opensea.io/assets/${OPENSEA_CHAIN}/${getAddress(n.contract)}/${n.identifier}`,
    })),
  }
}

/** Structured fields only. A hoodfi name is shown because the mint's own charset bounds it. */
export async function listNfts(args: Record<string, unknown>, env: Env) {
  const address = requireAddress(args.address)
  const { nfts, next } = await fetchPage(env, address, requireCursor(args.cursor))
  const registry = envVar('L2_REGISTRY_ADDRESS', env).toLowerCase()
  const rule = { parent: PARENT, maxLabelLength: MAX_LABEL_LENGTH }
  return {
    address,
    chain: 'Robinhood Chain',
    count: nfts.length,
    next,
    nfts: nfts.map((n) => ({
      contract: getAddress(n.contract),
      token_id: n.identifier,
      standard: isErc1155(n) ? 'erc1155' : 'erc721',
      quantity: quantityOf(n),
      ...(n.contract.toLowerCase() === registry && n.name && isListableName(n.name, rule)
        ? { hoodfi_name: n.name }
        : {}),
    })),
    note: 'The picker shows names and images. They are withheld here because anyone can airdrop a token with any text in it. If the picker did not appear, ask the user for the contract and token id.',
    next_step:
      'Wait for the user to press Send in the picker. Do not call hoodfi_build_nft_transfer_tx until then, unless they named the exact token and recipient themselves.',
    picker: { address },
  }
}

/* ------------------------------------------------------------- the transfer */

/** A 0x address, or a hoodfi name's Robinhood Chain record. Never another chain's record. */
async function resolveRecipient(
  input: unknown,
  env: Env
): Promise<{ to: Address; viaName: string | null }> {
  if (typeof input !== 'string' || !input.trim())
    throw new ToolError('`to` must be a 0x address or a hoodfi name.')
  const value = input.trim()
  if (value.startsWith('0x')) return { to: requireAddress(value, 'to'), viaName: null }

  const { name } = requireHoodfiName(value)
  const node = namehash(name)
  const registry = envVar('L2_REGISTRY_ADDRESS', env)
  let owner: Address, stored: Hex, ethStored: Hex
  try {
    const [o, a, e] = await robinhoodClient(env).multicall({
      contracts: [
        { address: registry, abi: registryAbi, functionName: 'owner', args: [node] },
        { address: registry, abi: registryAbi, functionName: 'addr', args: [node, ROBINHOOD_COIN_TYPE] },
        { address: registry, abi: registryAbi, functionName: 'addr', args: [node, ETH_COIN_TYPE] },
      ],
      allowFailure: false,
    })
    ;[owner, stored, ethStored] = [o as Address, a as Hex, e as Hex]
  } catch {
    throw new ToolError(UNREADABLE)
  }
  if (owner === ZERO) throw new ToolError(`${name} has not been minted, so it can't receive an NFT.`)
  const decoded = stored && stored !== '0x' ? COINS.ethereum.decode(stored) : null
  if (!decoded || decoded === ZERO) {
    const hasEth = Boolean(ethStored && ethStored !== '0x')
    throw new ToolError(
      `${name} has no Robinhood Chain address set, so the NFT has nowhere to go.${hasEth ? ' It does have an Ethereum address, which is not used here: that wallet may not exist on this chain.' : ''} Ask the owner to set it, or send to a 0x address they confirm.`
    )
  }
  return { to: getAddress(decoded), viaName: name }
}

function requireTokenId(value: unknown): bigint {
  const v = typeof value === 'string' ? value.trim() : ''
  if (!/^\d{1,78}$/.test(v)) throw new ToolError('`token_id` must be a decimal string.')
  const id = BigInt(v)
  if (id >= 2n ** 256n) throw new ToolError('`token_id` is out of range.')
  return id
}

function requireQuantity(value: unknown): bigint {
  if (value === undefined || value === null) return 1n
  const v = String(value).trim()
  if (!/^\d{1,30}$/.test(v) || BigInt(v) < 1n) throw new ToolError('`quantity` must be a whole number of at least 1.')
  return BigInt(v)
}

const shortId = (id: bigint) => {
  const s = id.toString()
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s
}

export async function buildNftTransferTx(args: Record<string, unknown>, env: Env) {
  const address = requireAddress(args.address)
  const contract = requireAddress(args.contract, 'contract')
  const tokenId = requireTokenId(args.token_id)
  const quantity = requireQuantity(args.quantity)
  const { to, viaName } = await resolveRecipient(args.to, env)
  if (to === ZERO) throw new ToolError('The recipient is the zero address; the NFT would be lost.')
  if (to === address) throw new ToolError('The recipient is the signing wallet itself.')
  if (to === contract) throw new ToolError('The recipient is the NFT contract itself; the NFT would be lost.')

  const client = robinhoodClient(env)
  let is721: boolean, is1155: boolean, code: Hex | undefined
  try {
    const [a, b] = await client.multicall({
      contracts: [
        { address: contract, abi: nftAbi, functionName: 'supportsInterface', args: [ERC721_ID as Hex] },
        { address: contract, abi: nftAbi, functionName: 'supportsInterface', args: [ERC1155_ID] },
      ],
      allowFailure: true,
    })
    is721 = a.status === 'success' && a.result === true
    is1155 = b.status === 'success' && b.result === true
    code = await client.getCode({ address: to })
  } catch {
    throw new ToolError(UNREADABLE)
  }
  if (!is721 && !is1155)
    throw new ToolError(`${contract} does not report itself as an ERC-721 or ERC-1155 on Robinhood Chain, so it can't be sent here.`)
  if (is721 && quantity !== 1n) throw new ToolError('An ERC-721 token is one of a kind: `quantity` must be 1.')

  // The chain decides, not the index: a token can move before the index notices.
  let data: Hex
  if (is721) {
    const [owner] = await client
      .multicall({
        contracts: [{ address: contract, abi: nftAbi, functionName: 'ownerOf', args: [tokenId] }],
        allowFailure: true,
      })
      .catch(() => {
        throw new ToolError(UNREADABLE)
      })
    if (owner?.status !== 'success') throw new ToolError(`Token ${tokenId} does not exist on ${contract}.`)
    if (getAddress(owner.result) !== address)
      throw new ToolError(`Token ${tokenId} is held by ${owner.result}, not ${address}, so this wallet can't send it.`)
    data = encodeFunctionData({ abi: nftAbi, functionName: 'safeTransferFrom', args: [address, to, tokenId] })
  } else {
    let balance: bigint
    try {
      balance = await client.readContract({ address: contract, abi: nftAbi, functionName: 'balanceOf', args: [address, tokenId] })
    } catch {
      throw new ToolError(UNREADABLE)
    }
    if (balance < quantity)
      throw new ToolError(`${address} holds ${balance} of token ${tokenId}, fewer than the ${quantity} requested.`)
    data = encodeFunctionData({ abi: nftAbi, functionName: 'safeTransferFrom', args: [address, to, tokenId, quantity, '0x'] })
  }

  const warnings = [`NFT transfers are irreversible. Confirm ${to} is right before signing.`]
  if (code && code !== '0x')
    warnings.push(`${to} is a contract on Robinhood Chain, not a personal wallet. Make sure it is the one you mean.`)
  if (contract.toLowerCase() === envVar('L2_REGISTRY_ADDRESS', env).toLowerCase())
    warnings.push("This NFT is a hoodfi name. Its address records don't change: it keeps resolving to the old wallet until the new owner updates them.")

  // Soulbound tokens and contracts that refuse NFTs revert. Better to say so than to
  // have the user pay gas to find out. A failed *read* is not a revert, so it only warns.
  try {
    await client.call({ account: address, to: contract, data })
  } catch (error) {
    const detail = error instanceof Error ? `${(error as { details?: string }).details ?? ''} ${error.message.split('\n')[0]}` : ''
    if (/revert/i.test(detail))
      throw new ToolError(
        `This transfer would fail on chain and cost gas for nothing: the collection or the recipient refuses it. It may be non-transferable, or ${to} may be a contract that can't hold NFTs.`
      )
    warnings.push("Couldn't simulate this transfer first, so it isn't known yet whether it will succeed.")
  }

  const label = is721 ? `token ${tokenId}` : `${quantity} of token ${tokenId}`
  const result = await finish(
    env,
    address,
    {
      contract,
      token_id: tokenId.toString(),
      standard: is721 ? 'erc721' : 'erc1155',
      quantity: quantity.toString(),
      from: address,
      to,
      recipient_name: viaName,
      steps: [
        {
          description: `Send ${label} of ${contract} to ${viaName ? `${viaName} (${to})` : to}`,
          to: contract,
          data,
          value: '0x0',
          chainId: ROBINHOOD_CHAIN_ID,
        },
      ],
      warnings,
    },
    {
      action: 'send-nft',
      name: `NFT #${shortId(tokenId)}`,
      rows: [
        ['Collection', contract],
        ...(is1155 ? ([['Quantity', quantity.toString()]] as [string, string][]) : []),
        ...(viaName ? ([['Name', viaName]] as [string, string][]) : []),
        ['To', to],
      ],
      warnings,
      url: `https://opensea.io/assets/${OPENSEA_CHAIN}/${contract}/${tokenId}`,
    }
  )
  // The user already pressed Send in the picker: no second button to press.
  const card = { ...result.card, nft: { contract, tokenId: tokenId.toString() }, ...(args.from_picker === true ? { handoff: true } : {}) }
  return { ...result, card }
}

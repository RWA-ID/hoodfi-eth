import {
  type Address,
  type Hex,
  type PublicClient,
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  fallback,
  getAddress,
  http,
  isAddress,
  namehash,
} from 'viem'

import { registrarAbi, registryAbi } from './abi.js'
import { CHAINS, type SendChain, paymentCaveat } from './coins.js'
import {
  CONTRACTS,
  DEFAULT_API_URL,
  DEFAULT_ROBINHOOD_RPC,
  FALLBACK_ROBINHOOD_RPC,
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_EXPLORER,
  robinhoodChain,
} from './constants.js'
import { type ContentHash, contentGatewayUrl, decodeContenthash } from './contenthash.js'
import { type NameStatus, STATUS_TEXT, checkHoodfiName, checkLabel, fullName, tierOf } from './labels.js'

export type HoodfiErrorCode =
  /** The input isn't a valid hoodfi.eth name. Nothing was read. */
  | 'INVALID_NAME'
  /** The name exists, or can't be minted right now. `checkName` explains why. */
  | 'UNAVAILABLE'
  /** The name has never been minted. */
  | 'NOT_REGISTERED'
  /** The name has no record for the chain asked about. Do NOT fall back to another one. */
  | 'NO_RECORD'
  /**
   * The chain or API didn't answer. This says nothing about the name: never show it as
   * "not registered" or "no names". Retry.
   */
  | 'UNREADABLE'

export class HoodfiError extends Error {
  readonly code: HoodfiErrorCode
  constructor(code: HoodfiErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'HoodfiError'
    this.code = code
  }
}

export interface HoodfiClientOptions {
  /**
   * Robinhood Chain RPC URLs, tried in order before the public defaults. The public RPC
   * throttles per IP; a server doing volume should pass its own endpoint here.
   */
  rpcUrls?: string[]
  /** Bring your own viem client instead. It must be connected to chain 4663. */
  publicClient?: PublicClient
  /** HoodFi gateway base URL, for reverse lookups. */
  apiUrl?: string
  /** Override `fetch` (tests, proxies). */
  fetch?: typeof fetch
}

export interface NameCheck {
  name: string
  label: string
  length: number
  /** 0-3 for 1, 2, 3 and 4+ characters. */
  tier: 0 | 1 | 2 | 3
  status: NameStatus
  /** True only when status is available AND minting isn't paused. */
  available: boolean
  paused: boolean
  /** Why it can't be registered, in a sentence you can show. Undefined when available. */
  reason?: string
  price: {
    /** ETH price in wei, from the registrar's live price feed. */
    wei: bigint
    /** USDG price, 6 decimals. */
    usdg: bigint
  }
}

export interface NameProfile {
  name: string
  node: Hex
  owner: Address
  /**
   * Robinhood Chain and Ethereum are separate records. They normally hold the same
   * address, but reported apart so a name where they differ is visible.
   */
  addresses: Record<SendChain, string | null>
  /** Text records that are set: avatar, description, url, com.twitter, com.github, email. */
  records: Partial<Record<TextKey, string>>
  /** The name's website, or null when it has none (or one in a namespace not decoded here). */
  website: (ContentHash & { url: string; gateway: string }) | null
  explorer: string
}

export interface SendAddress {
  name: string
  chain: SendChain
  address: string
  /** E.g. the Robinhood and Ethereum records disagree. Show these to the sender. */
  warnings: string[]
  /** What a well-formed record can't prove (Solana has no checksum, XRP r-addresses no tag). */
  caveat: string | null
}

export interface OwnedName {
  name: string
  node: Hex
  /** The name's ETH address record, or null when unset. */
  addr: Address | null
  /** True when the name's record points back at this address. Only these may be shown as "this wallet is X". */
  resolves: boolean
  avatar: string | null
}

export interface AddressLookup {
  address: Address
  /** The name to display for this address: it resolves back to it. Null when none does. */
  primary: string | null
  /** "ens": the holder set it as their ENS primary. "inferred": shortest name that resolves back. */
  primarySource: 'ens' | 'inferred' | null
  /** Every hoodfi name this address holds now, resolving ones first. */
  names: OwnedName[]
}

export interface TxStep {
  description: string
  to: Address
  data: Hex
  value: bigint
  chainId: typeof ROBINHOOD_CHAIN_ID
}

export interface Registration {
  name: string
  label: string
  payWith: 'eth' | 'usdg'
  /** The price at quote time. ETH steps send `price.wei` plus the overpay buffer. */
  price: { wei: bigint; usdg: bigint }
  /** Send in order; wait for each receipt (and check its status) before the next. */
  steps: TxStep[]
  /** E.g. the account can't afford it yet. The steps still build. */
  warnings: string[]
}

const TEXT_KEYS = ['avatar', 'description', 'url', 'com.twitter', 'com.github', 'email'] as const
export type TextKey = (typeof TEXT_KEYS)[number]

const UNREADABLE_MSG =
  'Could not read Robinhood Chain: the reads failed rather than coming back empty, so this says nothing about the name. Try again shortly.'

function unavailableReason(status: number, label: string): string | undefined {
  switch (status) {
    case 0:
      return undefined
    case 1:
      return `${fullName(label)} is already registered.`
    case 2:
      return `${fullName(label)} is locked and not on sale right now.`
    case 3:
      return `${label} is not a valid label.`
    case 4:
      return `${label} is reserved and can never be registered.`
    default:
      return `${fullName(label)} is not available (status ${status}).`
  }
}

/**
 * A batch where nothing succeeded is a dead connection, not an answer.
 *
 * With `allowFailure: true`, a failed aggregate call (a 429 from a throttled RPC) marks
 * every entry as failed, exactly like each one reverting. For a never-minted name only
 * `ownerOf` reverts; `addr`/`text`/`contenthash` return empty successfully. So "all
 * failed" can only mean the transport.
 */
function batchFailed(results: readonly { status: 'success' | 'failure' }[]): boolean {
  return results.every((r) => r.status === 'failure')
}

function requireName(input: string): { name: string; labels: string[] } {
  if (typeof input !== 'string') throw new HoodfiError('INVALID_NAME', 'Name must be a string.')
  const checked = checkHoodfiName(input)
  if (!checked.ok) throw new HoodfiError('INVALID_NAME', checked.reason)
  return checked
}

function requireLabel(input: string): string {
  if (typeof input !== 'string') throw new HoodfiError('INVALID_NAME', 'Name must be a string.')
  const checked = checkLabel(input)
  if (!checked.ok) throw new HoodfiError('INVALID_NAME', checked.reason)
  return checked.label
}

function requireAddress(value: string): Address {
  if (typeof value !== 'string' || !isAddress(value, { strict: false }))
    throw new HoodfiError('INVALID_NAME', 'Expected a 0x-prefixed 20-byte address.')
  return getAddress(value)
}

export interface HoodfiClient {
  checkName(name: string): Promise<NameCheck>
  resolve(name: string): Promise<NameProfile | null>
  getSendAddress(name: string, chain: SendChain): Promise<SendAddress>
  lookupAddress(address: string): Promise<AddressLookup>
  buildRegistration(args: { name: string; account: string; payWith?: 'eth' | 'usdg'; overpayBps?: number }): Promise<Registration>
  /** The viem client in use, e.g. for `waitForTransactionReceipt`. */
  publicClient: PublicClient
}

export function createHoodfiClient(options: HoodfiClientOptions = {}): HoodfiClient {
  const client: PublicClient =
    options.publicClient ??
    (createPublicClient({
      chain: robinhoodChain,
      transport: fallback(
        [...(options.rpcUrls ?? []), DEFAULT_ROBINHOOD_RPC, FALLBACK_ROBINHOOD_RPC].map((url) =>
          http(url, { retryCount: 2, retryDelay: 200, timeout: 8_000 })
        ),
        // Ranking probes every endpoint in the background, spending the rate limit
        // this fallback exists to conserve.
        { rank: false }
      ),
    }) as PublicClient)
  const apiUrl = (options.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch

  async function readRegistrar(label: string) {
    try {
      // allowFailure: false: none of these can revert for a valid label, so a failure
      // is the RPC, and must not be folded into an answer.
      const [status, prices, paused] = await client.multicall({
        contracts: [
          { address: CONTRACTS.registrar, abi: registrarAbi, functionName: 'status', args: [label] },
          { address: CONTRACTS.registrar, abi: registrarAbi, functionName: 'priceOf', args: [label] },
          { address: CONTRACTS.registrar, abi: registrarAbi, functionName: 'paused' },
        ],
        allowFailure: false,
      })
      return { status, wei: prices[0], usdg: prices[1], paused }
    } catch (cause) {
      throw new HoodfiError('UNREADABLE', UNREADABLE_MSG, { cause })
    }
  }

  /** Is a name free, and what does it cost? Prices are live from the registrar. */
  async function checkName(name: string): Promise<NameCheck> {
    const label = requireLabel(name)
    const { status, wei, usdg, paused } = await readRegistrar(label)
    const reason = paused ? 'Minting is paused by the registrar owner.' : unavailableReason(status, label)
    return {
      name: fullName(label),
      label,
      length: label.length,
      tier: tierOf(label),
      status: STATUS_TEXT[status] ?? 'invalid',
      available: status === 0 && !paused,
      paused,
      ...(reason !== undefined && { reason }),
      price: { wei, usdg },
    }
  }

  /**
   * Everything a name holds, in one RPC round-trip. Returns null when the name was never
   * minted. Throws UNREADABLE (never null) when the chain didn't answer.
   *
   * Accepts `gm`, `gm.hoodfi.eth` or a subname like `jack.gm.hoodfi.eth`. Does not accept
   * `gm.eth`: that's a different name on Ethereum.
   */
  async function resolve(name: string): Promise<NameProfile | null> {
    const checked = requireName(name)
    const node = namehash(checked.name)
    const r = CONTRACTS.registry
    const addrAt = (coinType: bigint) =>
      ({ address: r, abi: registryAbi, functionName: 'addr', args: [node, coinType] }) as const
    const text = (key: TextKey) => ({ address: r, abi: registryAbi, functionName: 'text', args: [node, key] }) as const

    let results
    try {
      results = await client.multicall({
        contracts: [
          { address: r, abi: registryAbi, functionName: 'ownerOf', args: [BigInt(node)] },
          addrAt(CHAINS.robinhood.coinType),
          addrAt(CHAINS.ethereum.coinType),
          addrAt(CHAINS.bitcoin.coinType),
          addrAt(CHAINS.solana.coinType),
          addrAt(CHAINS.xrp.coinType),
          { address: r, abi: registryAbi, functionName: 'contenthash', args: [node] },
          text('avatar'),
          text('description'),
          text('url'),
          text('com.twitter'),
          text('com.github'),
          text('email'),
        ],
        allowFailure: true,
        // viem splits a multicall past 1024 bytes of calldata by default; these 13 reads
        // are ~1.2 KB. One request is the point: two is the shape public RPCs throttle.
        batchSize: 0,
      })
    } catch (cause) {
      throw new HoodfiError('UNREADABLE', UNREADABLE_MSG, { cause })
    }
    if (batchFailed(results)) throw new HoodfiError('UNREADABLE', UNREADABLE_MSG)

    const [owner, rh, eth, btc, sol, xrp, contenthash, ...texts] = results
    if (!owner || owner.status === 'failure') return null

    const stored = (e: (typeof results)[number] | undefined): Hex =>
      e && e.status === 'success' && typeof e.result === 'string' ? (e.result as Hex) : '0x'

    const records: Partial<Record<TextKey, string>> = {}
    TEXT_KEYS.forEach((key, i) => {
      const e = texts[i]
      if (e && e.status === 'success' && typeof e.result === 'string' && e.result) records[key] = e.result
    })

    const content = decodeContenthash(stored(contenthash))
    return {
      name: checked.name,
      node,
      owner: getAddress(owner.result as Address),
      addresses: {
        robinhood: CHAINS.robinhood.decode(stored(rh)),
        ethereum: CHAINS.ethereum.decode(stored(eth)),
        bitcoin: CHAINS.bitcoin.decode(stored(btc)),
        solana: CHAINS.solana.decode(stored(sol)),
        xrp: CHAINS.xrp.decode(stored(xrp)),
      },
      records,
      website: content
        ? { ...content, url: `https://${checked.name}.link/`, gateway: contentGatewayUrl(content) }
        : null,
      explorer: `${ROBINHOOD_EXPLORER}/token/${r}/instance/${BigInt(node).toString()}`,
    }
  }

  /**
   * The address to pay `name` at on `chain`, or a HoodfiError.
   *
   * Reads that chain's own record and nothing else. An empty Robinhood Chain record is
   * NOT filled from the Ethereum one (or vice versa): a contract wallet like a Safe only
   * exists on chains it was deployed to, and funds sent to its address elsewhere are
   * stuck. Empty means ask the recipient.
   */
  async function getSendAddress(name: string, chain: SendChain): Promise<SendAddress> {
    const spec = CHAINS[chain]
    if (!spec) throw new HoodfiError('INVALID_NAME', `Unknown chain "${String(chain)}".`)
    const profile = await resolve(name)
    if (!profile) throw new HoodfiError('NOT_REGISTERED', `${requireName(name).name} is not registered.`)

    const address = profile.addresses[chain]
    const sibling = chain === 'robinhood' ? 'ethereum' : chain === 'ethereum' ? 'robinhood' : null
    const other = sibling ? profile.addresses[sibling] : null

    if (!address)
      throw new HoodfiError(
        'NO_RECORD',
        `${profile.name} has no ${spec.label} address set, so it can't be paid there. Don't send to one of its other addresses instead.` +
          (other && sibling ? ` It does have a ${CHAINS[sibling].label} address; the owner should set both.` : '')
      )

    const warnings: string[] = []
    if (other && sibling && other !== address)
      warnings.push(
        `${profile.name}'s two ETH records disagree: ${spec.label} → ${address}, ${CHAINS[sibling].label} → ${other}. This uses the ${spec.label} one; confirm with the recipient.`
      )
    return { name: profile.name, chain, address, warnings, caveat: paymentCaveat(chain, address) }
  }

  /**
   * The hoodfi names an address holds, and which one to display for it.
   *
   * Served by the HoodFi gateway (it indexes Transfer logs; the registry isn't
   * enumerable), cached ~60s. Throws UNREADABLE on a failed read: an empty `names` list
   * really means none.
   */
  async function lookupAddress(address: string): Promise<AddressLookup> {
    const checksummed = requireAddress(address)
    let response: Response
    try {
      response = await doFetch(`${apiUrl}/owner/${checksummed}/names`, { headers: { accept: 'application/json' } })
    } catch (cause) {
      throw new HoodfiError('UNREADABLE', 'Could not reach the HoodFi API. Try again shortly.', { cause })
    }
    if (!response.ok)
      throw new HoodfiError('UNREADABLE', `The HoodFi API answered ${response.status}. This says nothing about the address; try again shortly.`)
    return (await response.json()) as AddressLookup
  }

  /**
   * Unsigned transactions that register `name` for `account`.
   *
   * The registrar mints to whoever SENDS the transaction: there is no recipient
   * argument. Sign with `account` or the name goes to the actual signer.
   *
   * `payWith: 'usdg'` adds an approve step when the allowance is short. `overpayBps`
   * (ETH only, default 100 = 1%) absorbs price-feed movement between quote and send;
   * the registrar refunds anything above the price to the sender.
   */
  async function buildRegistration(args: {
    name: string
    account: string
    payWith?: 'eth' | 'usdg'
    overpayBps?: number
  }): Promise<Registration> {
    const label = requireLabel(args.name)
    const account = requireAddress(args.account)
    const payWith = args.payWith ?? 'eth'
    if (payWith !== 'eth' && payWith !== 'usdg') throw new HoodfiError('INVALID_NAME', 'payWith must be "eth" or "usdg".')
    const overpayBps = args.overpayBps ?? 100
    if (!Number.isInteger(overpayBps) || overpayBps < 0 || overpayBps > 10_000)
      throw new HoodfiError('INVALID_NAME', 'overpayBps must be an integer from 0 to 10000.')

    const { status, wei, usdg, paused } = await readRegistrar(label)
    if (paused) throw new HoodfiError('UNAVAILABLE', 'Minting is paused by the registrar owner.')
    const reason = unavailableReason(status, label)
    if (reason) throw new HoodfiError('UNAVAILABLE', reason)

    const name = fullName(label)
    const steps: TxStep[] = []
    const warnings: string[] = []

    try {
      if (payWith === 'eth') {
        const value = wei + (wei * BigInt(overpayBps)) / 10_000n
        const balance = await client.getBalance({ address: account })
        if (balance < value) warnings.push(`${account} holds less ETH on Robinhood Chain than the ${value} wei this sends.`)
        steps.push({
          description: `Register ${name}`,
          to: CONTRACTS.registrar,
          data: encodeFunctionData({ abi: registrarAbi, functionName: 'register', args: [label] }),
          value,
          chainId: ROBINHOOD_CHAIN_ID,
        })
      } else {
        const [allowance, balance] = await client.multicall({
          contracts: [
            { address: CONTRACTS.usdg, abi: erc20Abi, functionName: 'allowance', args: [account, CONTRACTS.registrar] },
            { address: CONTRACTS.usdg, abi: erc20Abi, functionName: 'balanceOf', args: [account] },
          ],
          allowFailure: false,
        })
        if (balance < usdg) warnings.push(`${account} holds less USDG than the price.`)
        if (allowance < usdg)
          steps.push({
            description: 'Approve the registrar to spend the USDG price',
            to: CONTRACTS.usdg,
            data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [CONTRACTS.registrar, usdg] }),
            value: 0n,
            chainId: ROBINHOOD_CHAIN_ID,
          })
        steps.push({
          description: `Register ${name}`,
          to: CONTRACTS.registrar,
          data: encodeFunctionData({ abi: registrarAbi, functionName: 'registerWithUsdc', args: [label] }),
          value: 0n,
          chainId: ROBINHOOD_CHAIN_ID,
        })
      }
    } catch (cause) {
      throw new HoodfiError('UNREADABLE', UNREADABLE_MSG, { cause })
    }

    return { name, label, payWith, price: { wei, usdg }, steps, warnings }
  }

  return { checkName, resolve, getSendAddress, lookupAddress, buildRegistration, publicClient: client }
}


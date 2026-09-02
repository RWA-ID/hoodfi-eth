import {
  type Address,
  type ContractFunctionParameters,
  type Hex,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
  namehash,
  numberToHex,
} from 'viem'

// One copy of the EIP-1577 codec, shared with the site: two implementations of a byte
// format is how a name ends up holding a well-formed record that resolves to nothing.
import {
  contentGatewayUrl,
  decodeContenthash,
  encodeContenthash,
  nameUrl,
  parseContenthash,
} from '../../frontend/shared/contenthash'
import {
  ETH_COIN_TYPE,
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_COIN_TYPE,
  ROBINHOOD_EXPLORER,
  type RobinhoodClient,
  robinhoodClient,
} from './chain'
import {
  BTC_COIN_TYPE,
  COINS,
  COIN_KEYS,
  type CoinKey,
  SOL_COIN_TYPE,
  verificationCaveat,
} from './coins'
import { erc20Abi, registrarAbi, registryAbi } from './contracts'
import { type Env, envVar } from './env'
import {
  PARENT,
  PUBLIC_MIN_LENGTH,
  STATUS_TEXT,
  checkLabel,
  fullName,
  isShort,
  tierOf,
} from './labels'

/** A tool call that failed for a reason the agent can act on. */
export class ToolError extends Error {}

export interface ToolDefinition {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
}

/**
 * Tool descriptions carry three facts agents cannot infer from the schema and get
 * wrong every time otherwise: the name lands with whoever signs (the registrar mints
 * to msg.sender, there is no recipient argument), 1-3 character names cannot be bought
 * at any price right now, and an EVM address is two records rather than one.
 */
export const TOOLS: ToolDefinition[] = [
  {
    name: 'hoodfi_check_name',
    title: 'Check a hoodfi.eth name',
    description:
      'Check whether a name under hoodfi.eth is available and what it costs. Returns availability, the price in both ETH and USDG, and — when a name cannot be registered — the reason. Names of 1-3 characters are premium inventory and are NOT purchasable: they are reserved for donors holding short-name credits until the 100-year donation goal is reached. Accepts "example", "example.hoodfi.eth" or "example.eth".',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description:
            'The name to check, with or without the .hoodfi.eth suffix.',
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'hoodfi_build_registration_tx',
    title: 'Build a hoodfi.eth registration transaction',
    description:
      'Build the unsigned transaction(s) that register a hoodfi.eth name. This server holds no keys and never broadcasts: it returns calldata for the caller to sign and submit on Robinhood Chain (chain id 4663). IMPORTANT: the registrar mints to the transaction sender, so the name is owned by whichever wallet signs — there is no recipient parameter and a name cannot be minted on behalf of someone else. Paying in USDG may return two steps (approve, then register); execute them in order. Only names of 4 or more characters can be registered.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description:
            'The name to register, with or without the .hoodfi.eth suffix.',
        },
        address: {
          type: 'string',
          description:
            'The wallet that will sign and therefore own the name. Used to check balances and allowances; it is not encoded into the calldata.',
        },
        payWith: {
          type: 'string',
          enum: ['eth', 'usdg'],
          description: 'Which asset to pay in. Defaults to eth.',
        },
        overpayBps: {
          type: 'number',
          description:
            'Optional ETH-only headroom in basis points (100 = 1%) added to the value, in case the owner changes prices between the quote and the submit. The registrar refunds any excess, so this costs nothing but gas. Defaults to 0.',
        },
      },
      required: ['name', 'address'],
      additionalProperties: false,
    },
  },
  {
    name: 'hoodfi_resolve_name',
    title: 'Resolve a hoodfi.eth name',
    description:
      'Look up a registered hoodfi.eth name: its owner, its address records, its text records (avatar, description, url, and socials), and its website — a name holding an IPFS or IPNS contenthash serves that site at <label>.hoodfi.eth.link. Returns registered: false if the name has never been minted.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description:
            'The name to resolve, with or without the .hoodfi.eth suffix.',
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'hoodfi_build_set_contenthash_tx',
    title: 'Build a transaction to point a name at a website',
    description:
      "Build the unsigned transaction that sets a name's EIP-1577 contenthash, which makes the name serve a website at <label>.hoodfi.eth.link with no DNS and no hosting. Accepts an IPFS or IPNS CID in any of the forms one gets copied in: a bare CID, ipfs://…, ipns://…, or a gateway URL. Only the name's current owner can sign it — pass their address and the tool checks it before returning calldata. Pass content: \"\" to clear the record and take the site down. Nothing is signed or sent here; the transaction is returned for the owner's own wallet.",
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description:
            'The name to publish, with or without the .hoodfi.eth suffix.',
        },
        content: {
          type: 'string',
          description:
            'The IPFS or IPNS target: a bare CID (Qm… or bafy…), an ipfs:// or ipns:// URI, an IPNS key (k51…), or a gateway URL with the CID in the path or host. An empty string clears the record.',
        },
        address: {
          type: 'string',
          description:
            'The wallet that will sign. Must currently own the name, or the transaction would revert.',
        },
      },
      required: ['name', 'content', 'address'],
      additionalProperties: false,
    },
  },
  {
    name: 'hoodfi_build_set_address_tx',
    title: 'Build a transaction to set a name’s address records',
    description:
      'Build the unsigned transaction that points a name at wallet addresses on Ethereum, Bitcoin and Solana, so paying the name resolves to the right address on each chain. Pass any combination of the three; when more than one changes they are batched through the registry\'s multicall, so the owner signs once. IMPORTANT: setting "ethereum" writes TWO records — mainnet ETH (coinType 60) and the Robinhood Chain coinType — because a name carrying only one resolves in some clients and silently fails in others. The tool does this itself; there is no coinType parameter. Bitcoin and Solana are stored in each chain\'s own encoding, so an address that does not parse is refused here with a reason rather than stored as bytes that resolve to nothing. How much that check proves differs by chain, and the response says so in a "verify" field you should relay: a Bitcoin address is checksummed and a typo is caught; an Ethereum address is only checked when it carries EIP-55 capitalisation; a Solana address has NO checksum at all, so a mistyped character is a different, equally valid-looking address that nothing here can detect. Pass "" for bitcoin or solana to clear that record; the ethereum record cannot be cleared, because the name would then resolve nowhere. Only the name\'s current owner can sign it — pass their address and the tool checks it before returning calldata. Nothing is signed or sent here.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description:
            'The name to set records on, with or without the .hoodfi.eth suffix.',
        },
        address: {
          type: 'string',
          description:
            'The wallet that will sign. Must currently own the name, or the transaction would revert.',
        },
        ethereum: {
          type: 'string',
          description:
            'The address the name should resolve to on Ethereum and every EVM chain, including Robinhood Chain. A 0x-prefixed 20-byte address. Cannot be cleared.',
        },
        bitcoin: {
          type: 'string',
          description:
            'The Bitcoin address the name should resolve to: legacy (1…), P2SH (3…) or bech32 (bc1…). An empty string clears the record.',
        },
        solana: {
          type: 'string',
          description:
            'The Solana address the name should resolve to, base58. An empty string clears the record.',
        },
      },
      required: ['name', 'address'],
      additionalProperties: false,
    },
  },
]

/**
 * Turns any failure into something safe to hand back.
 *
 * Raw viem errors are never returned: they embed the full transport URL, which for
 * this worker is the dedicated RPC with its API key in the path.
 */
function safeMessage(error: unknown): string {
  if (error instanceof ToolError) return error.message
  return 'Could not read Robinhood Chain right now. Try again shortly.'
}

function requireLabel(name: unknown): string {
  if (typeof name !== 'string') throw new ToolError('`name` must be a string.')
  const checked = checkLabel(name)
  if (!checked.ok) throw new ToolError(checked.reason)
  return checked.label
}

function requireAddress(value: unknown): Address {
  if (typeof value !== 'string' || !isAddress(value))
    throw new ToolError('`address` must be a 0x-prefixed 20-byte address.')
  // Pasted addresses arrive in every casing; checksum them once here so every
  // downstream read and comparison agrees.
  return getAddress(value)
}

/** Why a status code means the name is not registerable, in words an agent can relay. */
function unavailableReason(status: number, label: string): string | undefined {
  switch (status) {
    case 0:
      return undefined
    case 1:
      return `${fullName(label)} is already registered.`
    case 2:
      return `${fullName(label)} is ${label.length} character${label.length === 1 ? '' : 's'} long. Names under ${PUBLIC_MIN_LENGTH} characters are premium inventory, reserved for donors spending short-name credits until the 100-year donation goal is reached. They cannot be bought at any price today.`
    case 3:
      return `${label} is not a valid label.`
    case 4:
      return `${label} is on the reserved list and can never be registered.`
    default:
      return `${fullName(label)} is not available (status ${status}).`
  }
}

/**
 * status + priceOf + paused in one round-trip.
 *
 * `allowFailure: false` on purpose: none of these three can revert for a label that
 * passed validation, so a failure here is the RPC talking, not the contract, and it
 * has to propagate as an error rather than be folded into an answer.
 */
async function readRegistrar(
  client: RobinhoodClient,
  registrar: Address,
  label: string
) {
  const [status, prices, paused] = await client.multicall({
    contracts: [
      {
        address: registrar,
        abi: registrarAbi,
        functionName: 'status',
        args: [label],
      },
      {
        address: registrar,
        abi: registrarAbi,
        functionName: 'priceOf',
        args: [label],
      },
      { address: registrar, abi: registrarAbi, functionName: 'paused' },
    ],
    allowFailure: false,
  })

  return { status, weiPrice: prices[0], usdgPrice: prices[1], paused }
}

async function checkName(args: Record<string, unknown>, env: Env) {
  const label = requireLabel(args.name)
  const client = robinhoodClient(env)
  const registrar = envVar('REGISTRAR_ADDRESS', env)

  const { status, weiPrice, usdgPrice, paused } = await readRegistrar(
    client,
    registrar,
    label
  )
  const reason = unavailableReason(status, label)

  return {
    name: fullName(label),
    label,
    length: label.length,
    tier: tierOf(label),
    status: STATUS_TEXT[status] ?? `unknown (${status})`,
    available: status === 0 && !paused,
    registerableByAgents: status === 0 && !paused && !isShort(label),
    reason: paused
      ? 'Minting is currently paused by the registrar owner.'
      : reason,
    price: {
      eth: formatEther(weiPrice),
      wei: weiPrice.toString(),
      usdg: formatUnits(usdgPrice, 6),
      usdgRaw: usdgPrice.toString(),
    },
    parent: PARENT,
    chainId: ROBINHOOD_CHAIN_ID,
    note: 'Names are lifetime ERC-721s — no expiry and no renewal fees.',
  }
}

async function buildRegistrationTx(args: Record<string, unknown>, env: Env) {
  const label = requireLabel(args.name)
  const address = requireAddress(args.address)
  const payWith = args.payWith === undefined ? 'eth' : args.payWith
  if (payWith !== 'eth' && payWith !== 'usdg')
    throw new ToolError('`payWith` must be "eth" or "usdg".')

  const overpayBps = args.overpayBps === undefined ? 0 : Number(args.overpayBps)
  if (!Number.isFinite(overpayBps) || overpayBps < 0 || overpayBps > 10_000)
    throw new ToolError('`overpayBps` must be a number between 0 and 10000.')

  // Refuse the short-name path before spending any RPC budget on it. The contract
  // would revert with ShortNameLocked anyway; saying so in words is more useful than
  // handing back calldata that cannot succeed.
  if (isShort(label)) throw new ToolError(unavailableReason(2, label) as string)

  const client = robinhoodClient(env)
  const registrar = envVar('REGISTRAR_ADDRESS', env)

  const { status, weiPrice, usdgPrice, paused } = await readRegistrar(
    client,
    registrar,
    label
  )

  if (paused)
    throw new ToolError('Minting is currently paused by the registrar owner.')
  const reason = unavailableReason(status, label)
  if (reason) throw new ToolError(reason)

  const steps: Array<Record<string, unknown>> = []
  const warnings: string[] = []

  if (payWith === 'eth') {
    const value =
      weiPrice + (weiPrice * BigInt(Math.round(overpayBps))) / 10_000n
    const balance = await client.getBalance({ address })
    if (balance < value)
      warnings.push(
        `${address} holds ${formatEther(balance)} ETH on Robinhood Chain, less than the ${formatEther(value)} ETH this transaction sends. It will fail until the wallet is funded.`
      )

    steps.push({
      description: `Register ${fullName(label)} paying ${formatEther(value)} ETH`,
      to: registrar,
      data: encodeFunctionData({
        abi: registrarAbi,
        functionName: 'register',
        args: [label],
      }),
      value: numberToHex(value),
      valueEth: formatEther(value),
      chainId: ROBINHOOD_CHAIN_ID,
    })
  } else {
    const usdg = envVar('USDG_ADDRESS', env)
    const [allowance, balance] = await client.multicall({
      contracts: [
        {
          address: usdg,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, registrar],
        },
        {
          address: usdg,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address],
        },
      ],
      allowFailure: false,
    })

    if (balance < usdgPrice)
      warnings.push(
        `${address} holds ${formatUnits(balance, 6)} USDG, less than the ${formatUnits(usdgPrice, 6)} USDG price. The transaction will fail until the wallet is funded.`
      )

    if (allowance < usdgPrice) {
      steps.push({
        description: `Approve the registrar to spend ${formatUnits(usdgPrice, 6)} USDG`,
        to: usdg,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [registrar, usdgPrice],
        }),
        value: '0x0',
        valueEth: '0',
        chainId: ROBINHOOD_CHAIN_ID,
      })
    }

    steps.push({
      description: `Register ${fullName(label)} paying ${formatUnits(usdgPrice, 6)} USDG`,
      to: registrar,
      data: encodeFunctionData({
        abi: registrarAbi,
        functionName: 'registerWithUsdc',
        args: [label],
      }),
      value: '0x0',
      valueEth: '0',
      chainId: ROBINHOOD_CHAIN_ID,
    })
  }

  return {
    name: fullName(label),
    label,
    payWith,
    price:
      payWith === 'eth'
        ? { eth: formatEther(weiPrice), wei: weiPrice.toString() }
        : { usdg: formatUnits(usdgPrice, 6), usdgRaw: usdgPrice.toString() },
    steps,
    warnings,
    owner: address,
    ownershipNote: `The name will be owned by whichever wallet signs and sends these transactions. The registrar mints to msg.sender, so signing from an address other than ${address} will hand the name to that other address instead.`,
    explorer: `${ROBINHOOD_EXPLORER}/address/${registrar}`,
    ...(payWith === 'eth' && {
      refundNote:
        'The registrar refunds any ETH sent above the price, so overpaying is safe.',
    }),
  }
}

/**
 * The text records worth returning, in the order they are read below.
 *
 * Listed here for documentation only — the reads are written out one by one rather
 * than mapped over this array, because spreading a mapped array into the multicall
 * collapses TypeScript's per-call inference and every entry starts being checked
 * against the shape of the first one.
 */
const TEXT_KEYS = [
  'avatar',
  'description',
  'url',
  'com.twitter',
  'com.github',
  'email',
] as const

/** An `addr(node, coinType)` read, in the shape multicall wants. */
function addrRead(registry: Address, node: Hex, coinType: bigint) {
  return {
    address: registry,
    abi: registryAbi,
    functionName: 'addr',
    args: [node, coinType],
  } as const
}

async function resolveName(args: Record<string, unknown>, env: Env) {
  const label = requireLabel(args.name)
  const client = robinhoodClient(env)
  const registry = envVar('L2_REGISTRY_ADDRESS', env)
  const node = namehash(fullName(label))

  /**
   * Every record in one round-trip.
   *
   * The batching is not only about latency. Twelve separate reads from a Worker is the
   * exact shape a public RPC throttles, and the previous version caught a failed
   * `ownerOf` and reported the name as unregistered — so a rate-limited call turned a
   * registered name into a confident "registered: false". Same failure mode as a CCIP
   * gateway that answers "no records" when its backend is down: the outage disappears
   * and a lie takes its place.
   *
   * Going through Multicall3 is what makes the distinction available at all, but it is
   * `batchFailed()` below that draws it — `allowFailure: true` reports a dead connection
   * and a reverted call identically, so the batch does *not* throw on transport the way
   * this comment used to claim. Read that function before trusting a failure here.
   *
   * `batchSize: 0` is what makes "one round-trip" true rather than nearly true, and it
   * is now load-bearing rather than headroom. viem splits a multicall once the
   * accumulated calldata passes `batchSize`, default **1024 bytes**; these twelve reads
   * encode to 1136 (36 for ownerOf, 68 per addr, 36 for contenthash, 132 per text key),
   * so on the default they would arrive as two requests — which is the shape being
   * avoided. Adding the Bitcoin and Solana records is what took it past the limit; the
   * earlier note that the batch sat 24 bytes under it no longer holds. Do not restore a
   * default here on the assumption there is room. There is no gas cost to a wide
   * `eth_call`, so nothing is traded away by pinning it off.
   */
  const text = (key: (typeof TEXT_KEYS)[number]) =>
    ({
      address: registry,
      abi: registryAbi,
      functionName: 'text',
      args: [node, key],
    }) as const

  const addrAt = (coinType: bigint) => addrRead(registry, node, coinType)

  const [
    ownerResult,
    l2AddrResult,
    ethAddrResult,
    btcAddrResult,
    solAddrResult,
    contenthashResult,
    avatar,
    description,
    url,
    twitter,
    github,
    email,
  ] = await client.multicall({
    contracts: [
      {
        address: registry,
        abi: registryAbi,
        functionName: 'ownerOf',
        args: [BigInt(node)],
      },
      addrAt(ROBINHOOD_COIN_TYPE),
      addrAt(ETH_COIN_TYPE),
      addrAt(BTC_COIN_TYPE),
      addrAt(SOL_COIN_TYPE),
      {
        address: registry,
        abi: registryAbi,
        functionName: 'contenthash',
        args: [node],
      },
      text('avatar'),
      text('description'),
      text('url'),
      text('com.twitter'),
      text('com.github'),
      text('email'),
    ],
    allowFailure: true,
    batchSize: 0,
  })

  if (
    batchFailed([
      ownerResult,
      l2AddrResult,
      ethAddrResult,
      btcAddrResult,
      solAddrResult,
      contenthashResult,
      avatar,
      description,
      url,
      twitter,
      github,
      email,
    ])
  )
    throw new ToolError(UNREADABLE)

  if (ownerResult.status === 'failure') {
    return {
      name: fullName(label),
      label,
      registered: false,
      note: 'This name has never been minted. Use hoodfi_check_name to see whether it can be registered.',
    }
  }

  const owner = getAddress(ownerResult.result)
  const stored = (entry: (typeof l2AddrResult)): Hex =>
    entry.status === 'success' ? entry.result : '0x'

  const records: Record<string, string> = {}
  for (const [key, entry] of [
    ['avatar', avatar],
    ['description', description],
    ['url', url],
    ['com.twitter', twitter],
    ['com.github', github],
    ['email', email],
  ] as const) {
    if (entry.status === 'success' && entry.result) records[key] = entry.result
  }

  return {
    name: fullName(label),
    label,
    registered: true,
    owner,
    node,
    /**
     * `robinhoodChain` and `mainnet` are the same EVM address held under two
     * coinTypes — see COINS.ethereum. They are reported separately rather than folded
     * into one field precisely so a name where they have drifted apart is visible
     * instead of averaged away.
     */
    addresses: {
      robinhoodChain: COINS.ethereum.decode(stored(l2AddrResult)),
      mainnet: COINS.ethereum.decode(stored(ethAddrResult)),
      bitcoin: COINS.bitcoin.decode(stored(btcAddrResult)),
      solana: COINS.solana.decode(stored(solAddrResult)),
    },
    records,
    website: describeWebsite(
      label,
      contenthashResult.status === 'success' ? contenthashResult.result : '0x'
    ),
    explorer: `${ROBINHOOD_EXPLORER}/token/${registry}/instance/${BigInt(node).toString()}`,
  }
}

/**
 * The contenthash, in the terms an agent can act on.
 *
 * `url` is the answer to "where is this name's site" and is what should be relayed — the
 * name's own address, not a gateway link, because it keeps working when the CID changes.
 * `gateway` is the direct copy, for a client that would rather not depend on eth.link.
 *
 * A record in an unsupported namespace decodes to null, so this reports `published:
 * false` with the raw bytes still attached rather than inventing a link nobody checked.
 */
function describeWebsite(label: string, stored: Hex) {
  const content = decodeContenthash(stored)
  if (!content) {
    return stored && stored !== '0x'
      ? {
          published: false,
          note: 'This name holds a contenthash in a namespace this server does not decode (only IPFS and IPNS are supported). The raw record is included unchanged.',
          contenthash: stored,
        }
      : {
          published: false,
          note: `${fullName(label)} has no contenthash, so it does not serve a website. Its owner can publish one with hoodfi_build_set_contenthash_tx.`,
        }
  }
  return {
    published: true,
    url: nameUrl(label),
    protocol: content.protocol,
    cid: content.id,
    uri: content.uri,
    gateway: contentGatewayUrl(content),
    contenthash: stored,
  }
}

/**
 * Did the batch itself fail, rather than one call reverting inside it?
 *
 * `allowFailure: true` does not distinguish those two, which is the thing to know here:
 * when the aggregate call fails — a 429 from a throttled public RPC being the case that
 * actually happens — viem marks **every** entry in the chunk as a failure, identically to
 * each one having reverted. So "the batch throws on transport, a failed entry means the
 * token does not exist" was never true, and a rate-limited read was being reported as a
 * confident "this name was never minted".
 *
 * The discriminator is a property of the registry, verified against the live contract:
 * for a name that was never minted, `ownerOf` reverts while `text`, `addr` and
 * `contenthash` all return empty *successfully*. A batch in which nothing at all
 * succeeded therefore carries no answer about the name, only about the connection.
 */
function batchFailed(
  results: readonly { status: 'success' | 'failure' }[]
): boolean {
  return results.every((result) => result.status === 'failure')
}

const UNREADABLE =
  'Could not read Robinhood Chain right now: the reads failed rather than coming back empty, so this says nothing about whether the name exists. Try again shortly.'

/**
 * Publishing a website onto a name, as calldata the owner signs.
 *
 * The ownership check is the substance of this tool. `setContenthash` is owner-only, so
 * a wrong signer produces a revert an agent cannot read — and the likelier mistake is
 * subtler: the ERC-721 and the address records are separate things, so an agent acting
 * for a user whose wallet merely *resolves* from the name, rather than owning it, would
 * get calldata that looks right and fails. Reading `ownerOf` first turns that into a
 * sentence.
 */
async function buildSetContenthashTx(args: Record<string, unknown>, env: Env) {
  const label = requireLabel(args.name)
  const address = requireAddress(args.address)
  if (typeof args.content !== 'string')
    throw new ToolError('`content` must be a string. Pass "" to clear the record.')

  const client = robinhoodClient(env)
  const registry = envVar('L2_REGISTRY_ADDRESS', env)
  const node = namehash(fullName(label))

  const clearing = args.content.trim() === ''
  // Encode before spending any RPC budget: a CID that cannot be encoded is the caller's
  // mistake, and saying which shapes are accepted beats a revert.
  const hash = clearing ? '0x' : encodeContenthash(args.content)
  if (!hash)
    throw new ToolError(
      `\`content\` is not an IPFS or IPNS target this can publish: ${JSON.stringify(args.content.trim().slice(0, 80))}. Accepted: a bare CID (Qm… or bafy…), ipfs:// or ipns://, an IPNS key (k51…), or a gateway URL with the CID in its path or host. Swarm and Arweave are deliberately not supported. A CID with a trailing path is refused — the record cannot carry one.`
    )

  const [ownerResult, currentResult] = await client.multicall({
    contracts: [
      {
        address: registry,
        abi: registryAbi,
        functionName: 'ownerOf',
        args: [BigInt(node)],
      },
      {
        address: registry,
        abi: registryAbi,
        functionName: 'contenthash',
        args: [node],
      },
    ],
    allowFailure: true,
    batchSize: 0,
  })

  // Same reasoning as resolve, and the same trap: only a batch where the *other* read
  // came back can say anything about whether this token exists.
  if (batchFailed([ownerResult, currentResult])) throw new ToolError(UNREADABLE)
  if (ownerResult.status === 'failure')
    throw new ToolError(
      `${fullName(label)} has not been minted, so it has no records to set. Register it first with hoodfi_build_registration_tx.`
    )

  const owner = getAddress(ownerResult.result)
  if (owner !== address)
    throw new ToolError(
      `${fullName(label)} is owned by ${owner}, not ${address}. Only the owner can set its records, so this transaction would revert. Note that owning the name is what counts here — holding its address record is not the same thing.`
    )

  const current =
    currentResult.status === 'success' ? currentResult.result : undefined
  if (clearing && (!current || current === '0x'))
    throw new ToolError(
      `${fullName(label)} has no contenthash set, so there is nothing to clear.`
    )

  const parsed = clearing ? null : parseContenthash(args.content)

  return {
    name: fullName(label),
    label,
    owner,
    node,
    steps: [
      {
        description: clearing
          ? `Clear the contenthash on ${fullName(label)}, taking its website down`
          : `Point ${fullName(label)} at ${parsed?.uri}`,
        to: registry,
        data: encodeFunctionData({
          abi: registryAbi,
          functionName: 'setContenthash',
          args: [node, hash as Hex],
        }),
        value: '0x0',
        chainId: ROBINHOOD_CHAIN_ID,
      },
    ],
    ...(clearing
      ? { clears: true }
      : {
          publishes: {
            protocol: parsed?.protocol,
            cid: parsed?.id,
            uri: parsed?.uri,
            contenthash: hash,
            /** Where it will answer once the transaction lands. */
            url: nameUrl(label),
            /** The same content directly, for checking the CID before publishing it. */
            gateway: parsed ? contentGatewayUrl(parsed) : undefined,
          },
        }),
    ...(current && current !== '0x'
      ? {
          replaces: {
            contenthash: current,
            uri: decodeContenthash(current)?.uri ?? null,
          },
        }
      : {}),
    ownershipNote: `This transaction must be sent by ${owner}. It sets a record on the name and transfers nothing.`,
    note: 'Records live on Robinhood Chain and resolve through CCIP-Read, so the site answers on mainnet ENS resolvers too. Propagation is not instant: gateways and wallets cache the old record for a few minutes.',
  }
}

/**
 * Address records, as calldata the owner signs.
 *
 * Three things this does that an agent composing `setAddr` calls itself would not:
 *
 * **It encodes before it reads.** A Bitcoin or Solana address is stored in its own
 * chain's binary form, so the string an agent was handed is not what goes on chain.
 * Encoding first means a bad address comes back as a sentence naming the chain and
 * spends no RPC budget; `setAddr` takes `bytes` and would accept anything.
 *
 * How much that catches is *not* uniform, which is why `verificationCaveat` exists and
 * why its output is returned rather than logged. Bitcoin is checksummed end to end.
 * Ethereum is only checked when the caller supplied EIP-55 capitalisation. Solana has
 * no checksum whatsoever — any 32 bytes of base58 is a well-formed address, so a
 * one-character typo silently becomes a different valid key. Verified in
 * `coins.test.mjs`, and the reason this tool cannot promise a stored address is the
 * one that was meant.
 *
 * **It refuses a no-op.** Setting a record to the value it already holds is a real
 * transaction that emits a real event and changes nothing, which reads to an agent as
 * success. Having read the current values to report `replaces` anyway, saying so costs
 * nothing.
 *
 * **It checks `ownerOf` first**, for the same reason the contenthash tool does: the
 * ERC-721 and the address records are separate things, so an agent acting for a user
 * whose wallet merely *resolves* from the name would otherwise get calldata that looks
 * right and reverts.
 */
async function buildSetAddressTx(args: Record<string, unknown>, env: Env) {
  const label = requireLabel(args.name)
  const address = requireAddress(args.address)

  interface Pending {
    key: CoinKey
    coin: (typeof COINS)[CoinKey]
    /** The address as given, or null when the record is being cleared. */
    text: string | null
    bytes: Hex
    /** Set when encoding proved less than the caller is likely to assume. */
    caveat?: string | null
  }

  const pending: Pending[] = []
  for (const key of COIN_KEYS) {
    const raw = args[key]
    // Absent and empty are different asks: absent leaves the record alone, empty
    // clears it. Conflating them would make "set only bitcoin" wipe the others.
    if (raw === undefined || raw === null) continue
    if (typeof raw !== 'string')
      throw new ToolError(
        `\`${key}\` must be a string. Pass "" to clear the record, or leave it out to make no change.`
      )

    const coin = COINS[key]
    const trimmed = raw.trim()

    if (trimmed === '') {
      if (!coin.clearable)
        throw new ToolError(
          `The ${coin.label} record cannot be cleared: it is what ${fullName(label)} resolves to, and emptying it would leave the name resolving nowhere. Pass a different address to change it, or leave \`${key}\` out to make no change.`
        )
      pending.push({ key, coin, text: null, bytes: '0x' })
      continue
    }

    const bytes = coin.encode(trimmed)
    if (!bytes)
      throw new ToolError(
        `${JSON.stringify(trimmed.slice(0, 80))} is not a valid ${coin.label} address. Expected ${coin.hint}.`
      )
    pending.push({
      key,
      coin,
      text: trimmed,
      bytes,
      caveat: verificationCaveat(coin, trimmed),
    })
  }

  if (pending.length === 0)
    throw new ToolError(
      `Nothing to set. Pass at least one of ${COIN_KEYS.map((key) => `\`${key}\``).join(', ')}.`
    )

  const client = robinhoodClient(env)
  const registry = envVar('L2_REGISTRY_ADDRESS', env)
  const node = namehash(fullName(label))

  // One row per record that will actually be written — Ethereum contributes two.
  const writes = pending.flatMap((entry) =>
    entry.coin.coinTypes.map((coinType) => ({ entry, coinType }))
  )

  /**
   * Annotated rather than inferred: viem types a multicall from the literal shape of
   * its `contracts` array, and this one is built at runtime — the length depends on
   * which coins were passed. Inference collapses the mixed array onto the `addr` entry
   * and rejects the `ownerOf` call, so the array is widened here and each result is
   * narrowed at the point it is read.
   */
  const reads: ContractFunctionParameters[] = [
    {
      address: registry,
      abi: registryAbi,
      functionName: 'ownerOf',
      args: [BigInt(node)],
    },
    ...writes.map(({ coinType }) => addrRead(registry, node, coinType)),
  ]

  const results = await client.multicall({
    contracts: reads,
    allowFailure: true,
    batchSize: 0,
  })

  // Same trap as resolve and the contenthash tool: `allowFailure: true` reports a dead
  // connection and a reverted call identically, so only a batch where something came
  // back says anything about whether this name exists.
  if (batchFailed(results)) throw new ToolError(UNREADABLE)

  const ownerResult = results[0]
  if (!ownerResult || ownerResult.status === 'failure')
    throw new ToolError(
      `${fullName(label)} has not been minted, so it has no records to set. Register it first with hoodfi_build_registration_tx.`
    )

  const owner = getAddress(ownerResult.result as Address)
  if (owner !== address)
    throw new ToolError(
      `${fullName(label)} is owned by ${owner}, not ${address}. Only the owner can set its records, so this transaction would revert. Note that owning the name is what counts here — holding its address record is not the same thing.`
    )

  const calls: Array<{ coinType: bigint; entry: Pending; data: Hex }> = []
  const unchanged: string[] = []
  const replaces: Record<string, string | null> = {}

  writes.forEach(({ entry, coinType }, index) => {
    const read = results[index + 1]
    const current: Hex =
      read && read.status === 'success' ? (read.result as Hex) : '0x'

    // A record already holding these exact bytes is dropped from the batch rather
    // than rewritten. Comparing the encoded form, not the text, is what makes this
    // correct for a Bitcoin address typed in a different case.
    if (current.toLowerCase() === entry.bytes.toLowerCase()) {
      unchanged.push(`${entry.coin.label} (coinType ${coinType})`)
      return
    }

    if (current !== '0x')
      replaces[entry.key] = entry.coin.decode(current) ?? current

    calls.push({
      coinType,
      entry,
      data: encodeFunctionData({
        abi: registryAbi,
        functionName: 'setAddr',
        args: [node, coinType, entry.bytes],
      }),
    })
  })

  if (calls.length === 0)
    throw new ToolError(
      `${fullName(label)} already holds ${unchanged.length === 1 ? 'that record' : 'those records'} exactly as given — ${unchanged.join(', ')}. There is nothing to change, and sending the transaction would emit an event without altering anything.`
    )

  const clearing = calls.filter(({ entry }) => entry.text === null)
  const setting = calls.filter(({ entry }) => entry.text !== null)
  const described = [
    ...setting.map(({ entry }) => `${entry.coin.label} to ${entry.text}`),
    ...clearing.map(({ entry }) => `clear ${entry.coin.label}`),
  ].join(', ')

  /**
   * One call goes direct; several are batched through the resolver's `multicall`, so
   * the owner signs once however many records moved — the same batching `/manage`
   * does. Each inner call re-enters the registry and is authorised on its own, so
   * this grants nothing the direct calls would not.
   */
  const step =
    calls.length === 1 && calls[0]
      ? { to: registry, data: calls[0].data }
      : {
          to: registry,
          data: encodeFunctionData({
            abi: registryAbi,
            functionName: 'multicall',
            args: [calls.map((call) => call.data)],
          }),
        }

  return {
    name: fullName(label),
    label,
    owner,
    node,
    steps: [
      {
        description: `Set ${described} on ${fullName(label)}`,
        ...step,
        value: '0x0',
        chainId: ROBINHOOD_CHAIN_ID,
      },
    ],
    /** Every record this writes, including the second one Ethereum always carries. */
    sets: calls.map(({ entry, coinType }) => ({
      coin: entry.key,
      coinType: coinType.toString(),
      address: entry.text,
      bytes: entry.bytes,
      cleared: entry.text === null,
    })),
    ...(Object.keys(replaces).length > 0 ? { replaces } : {}),
    ...(unchanged.length > 0
      ? {
          skipped: `Already set to the requested value, so left out of the transaction: ${unchanged.join(', ')}.`,
        }
      : {}),
    /**
     * Where "it encoded cleanly" is weaker evidence than it looks. Returned as its own
     * field rather than folded into `note`, so an agent relaying anything at all to a
     * user relays this: these are payment addresses, and Solana in particular has no
     * checksum to catch a typo.
     */
    ...(() => {
      const caveats = calls
        .map(({ entry }) => entry.caveat)
        .filter((caveat): caveat is string => Boolean(caveat))
      // Ethereum writes two coinTypes, so the same caveat can arrive twice.
      const unique = [...new Set(caveats)]
      return unique.length > 0 ? { verify: unique } : {}
    })(),
    /**
     * Keyed off what is actually being written, not off what was asked for. When the
     * address is already set, both coinTypes drop out as no-ops and a note claiming
     * "both are in this transaction" would be describing calldata that isn't there.
     */
    ...(calls.some(({ entry }) => entry.key === 'ethereum')
      ? {
          ethereumNote: `The Ethereum address is written twice — once under coinType ${ETH_COIN_TYPE} for mainnet ENS clients and once under ${ROBINHOOD_COIN_TYPE} for Robinhood Chain. A name carrying only one of them resolves in some wallets and fails in others, so both are in this transaction${calls.filter(({ entry }) => entry.key === 'ethereum').length === 1 ? ' — except the one already holding this exact value, listed under `skipped`' : ''}.`,
        }
      : {}),
    ownershipNote: `This transaction must be sent by ${owner}. It sets records on the name and transfers nothing — no funds move and the name itself does not change hands.`,
    note: 'Records live on Robinhood Chain and resolve through CCIP-Read, so they answer on mainnet ENS resolvers too. Propagation is not instant: gateways and wallets cache the old value for a few minutes.',
  }
}

export async function callTool(
  name: string,
  args: Record<string, unknown>,
  env: Env
): Promise<{ text: string; isError: boolean }> {
  try {
    let result: unknown
    switch (name) {
      case 'hoodfi_check_name':
        result = await checkName(args, env)
        break
      case 'hoodfi_build_registration_tx':
        result = await buildRegistrationTx(args, env)
        break
      case 'hoodfi_resolve_name':
        result = await resolveName(args, env)
        break
      case 'hoodfi_build_set_contenthash_tx':
        result = await buildSetContenthashTx(args, env)
        break
      case 'hoodfi_build_set_address_tx':
        result = await buildSetAddressTx(args, env)
        break
      default:
        throw new ToolError(`Unknown tool: ${name}`)
    }
    return { text: JSON.stringify(result, null, 2), isError: false }
  } catch (error) {
    return { text: safeMessage(error), isError: true }
  }
}

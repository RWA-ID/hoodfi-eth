import {
  type Address,
  type Hex,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
  namehash,
  numberToHex,
} from 'viem'

import {
  ETH_COIN_TYPE,
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_COIN_TYPE,
  ROBINHOOD_EXPLORER,
  type RobinhoodClient,
  robinhoodClient,
} from './chain'
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
 * Tool descriptions carry two facts agents cannot infer from the schema and get
 * wrong every time otherwise: the name lands with whoever signs (the registrar mints
 * to msg.sender, there is no recipient argument), and 1-3 character names cannot be
 * bought at any price right now.
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
      'Look up a registered hoodfi.eth name: its owner, its address records, and its text records (avatar, description, url, and socials). Returns registered: false if the name has never been minted.',
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

async function resolveName(args: Record<string, unknown>, env: Env) {
  const label = requireLabel(args.name)
  const client = robinhoodClient(env)
  const registry = envVar('L2_REGISTRY_ADDRESS', env)
  const node = namehash(fullName(label))

  /**
   * Every record in one round-trip.
   *
   * The batching is not only about latency. Nine separate reads from a Worker is the
   * exact shape a public RPC throttles, and the previous version caught a failed
   * `ownerOf` and reported the name as unregistered — so a rate-limited call turned a
   * registered name into a confident "registered: false". Same failure mode as a CCIP
   * gateway that answers "no records" when its backend is down: the outage disappears
   * and a lie takes its place.
   *
   * Going through Multicall3 makes the distinction structural. If the batch itself
   * fails, that is transport and it throws. If the batch succeeds and only `ownerOf`
   * reverted inside it, the token genuinely does not exist.
   */
  const text = (key: (typeof TEXT_KEYS)[number]) =>
    ({
      address: registry,
      abi: registryAbi,
      functionName: 'text',
      args: [node, key],
    }) as const

  const [
    ownerResult,
    l2AddrResult,
    ethAddrResult,
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
      {
        address: registry,
        abi: registryAbi,
        functionName: 'addr',
        args: [node, ROBINHOOD_COIN_TYPE],
      },
      {
        address: registry,
        abi: registryAbi,
        functionName: 'addr',
        args: [node, ETH_COIN_TYPE],
      },
      text('avatar'),
      text('description'),
      text('url'),
      text('com.twitter'),
      text('com.github'),
      text('email'),
    ],
    allowFailure: true,
  })

  if (ownerResult.status === 'failure') {
    return {
      name: fullName(label),
      label,
      registered: false,
      note: 'This name has never been minted. Use hoodfi_check_name to see whether it can be registered.',
    }
  }

  const owner = getAddress(ownerResult.result)
  const l2Addr = l2AddrResult.status === 'success' ? l2AddrResult.result : '0x'
  const ethAddr =
    ethAddrResult.status === 'success' ? ethAddrResult.result : '0x'

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
    addresses: {
      robinhoodChain: decodeAddr(l2Addr),
      mainnet: decodeAddr(ethAddr),
    },
    records,
    explorer: `${ROBINHOOD_EXPLORER}/token/${registry}/instance/${BigInt(node).toString()}`,
  }
}

/** The registry stores addr records as raw bytes; 20 of them is an address. */
function decodeAddr(value: Hex): string | null {
  if (!value || value === '0x' || value.length !== 42) return null
  return getAddress(value)
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
      default:
        throw new ToolError(`Unknown tool: ${name}`)
    }
    return { text: JSON.stringify(result, null, 2), isError: false }
  } catch (error) {
    return { text: safeMessage(error), isError: true }
  }
}

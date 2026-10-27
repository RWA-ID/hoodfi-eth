import {
  type Address,
  type Hex,
  encodeFunctionData,
  formatEther,
  getAddress,
  isAddress,
  isHex,
  keccak256,
  namehash,
  parseTransaction,
  recoverTransactionAddress,
  type TransactionSerialized,
  decodeFunctionData,
} from 'viem'

import { type Card, type CardAction } from './card'
import {
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_COIN_TYPE,
  ROBINHOOD_EXPLORER,
  type RobinhoodClient,
  robinhoodClient,
} from './chain'
import {
  MAINNET_CHAIN_ID,
  type Step,
  clientFor,
  completeSteps,
  mainnetClient,
} from './complete'
import {
  REVERSE_REGISTRAR,
  erc20Abi,
  registrarAbi,
  registryAbi,
  reverseRegistrarAbi,
} from './contracts'
import { type Env, envVar } from './env'
import { ToolError } from './errors'
import { MAX_LABEL_LENGTH, PARENT, checkHoodfiName, checkLabel } from './labels'
import { isListableName, splitListable } from './owned-names'

/**
 * The tools an agent needs after registration: what a wallet holds, profile records,
 * subnames, transfer, the ENS primary name, and a relay for signing-only wallets.
 *
 * Same rules as tools.ts: this server holds no key and signs nothing. Every write comes
 * back as steps — and now each step carries a complete `transaction` (complete.ts) —
 * for the user's own wallet; `hoodfi_send_transaction` only broadcasts what was
 * already signed, and only the kinds of transaction this server builds.
 */

const UNREADABLE =
  'Could not read Robinhood Chain right now: the read failed rather than coming back empty, so this says nothing either way. Try again shortly.'

const ZERO = '0x0000000000000000000000000000000000000000'

/* ------------------------------------------------------------- inputs */

/**
 * A name at any depth: "gm", "gm.hoodfi.eth", "jack.gm" or "jack.gm.hoodfi.eth".
 * Every label passes the same check the mint does, so nothing created or addressed
 * here could have been refused at the top level.
 */
export function requireName(input: unknown): { name: string; labels: string[] } {
  if (typeof input !== 'string' || !input.trim())
    throw new ToolError('`name` must be a non-empty string.')
  const bare = input
    .trim()
    .toLowerCase()
    .replace(/\.hoodfi\.eth$/, '')
    .replace(/\.eth$/, '')
  const labels = bare.split('.')
  for (const label of labels) {
    const check = checkLabel(label)
    if (!check.ok) throw new ToolError(`"${label}": ${check.reason}`)
  }
  return { name: `${bare}.${PARENT}`, labels }
}

/**
 * requireName without the rewrite, for a name that is about to be paid: "vitalik.eth" is
 * refused rather than turned into vitalik.hoodfi.eth. See checkHoodfiName.
 */
export function requireHoodfiName(input: unknown): { name: string; labels: string[] } {
  if (typeof input !== 'string' || !input.trim())
    throw new ToolError('`name` must be a non-empty string.')
  const check = checkHoodfiName(input)
  if (!check.ok) throw new ToolError(check.reason)
  return { name: `${check.labels.join('.')}.${PARENT}`, labels: check.labels }
}

export function requireAddress(value: unknown, field = 'address'): Address {
  if (typeof value !== 'string' || !isAddress(value.trim(), { strict: false }))
    throw new ToolError(`\`${field}\` must be a 0x-prefixed 20-byte address.`)
  return getAddress(value.trim())
}

/** `owner(node)` — the zero address for a name never minted. Throws on a failed read. */
async function ownerOfNode(client: RobinhoodClient, registry: Address, node: Hex) {
  try {
    const owner = await client.readContract({
      address: registry,
      abi: registryAbi,
      functionName: 'owner',
      args: [node],
    })
    return owner === ZERO ? null : getAddress(owner)
  } catch {
    throw new ToolError(UNREADABLE)
  }
}

async function requireOwner(
  client: RobinhoodClient,
  registry: Address,
  name: string,
  address: Address
) {
  const node = namehash(name)
  const owner = await ownerOfNode(client, registry, node)
  if (!owner)
    throw new ToolError(`${name} has not been minted. Register it first with hoodfi_build_registration_tx.`)
  if (owner !== address)
    throw new ToolError(
      `${name} is owned by ${owner}, not ${address}. Only the owner can sign this, so the transaction would revert. If the name sits in another wallet, transfer it to ${address} first from that wallet (www.hoodfi.name → Manage → Transfer).`
    )
  return node
}

/* ------------------------------------------------------------- the card */

/**
 * Where "View" goes: a second-level name's own page (the gateway share page, via the
 * site's /<label> rewrite). /manage takes no name parameter, so a subname gets Manage
 * itself, where its holder's names are listed.
 */
export const nameLink = (name: string) => {
  const labels = name.replace(/\.hoodfi\.eth$/, '').split('.')
  return labels.length === 1 ? `https://www.hoodfi.name/${labels[0]}/` : 'https://www.hoodfi.name/manage'
}

export function cardFor(c: Omit<Card, 'steps'> & { steps: Step[] }): Card {
  return {
    ...c,
    steps: c.steps.map((s) => {
      const chain = s.chainId === MAINNET_CHAIN_ID ? 'Ethereum mainnet' : 'Robinhood Chain'
      const value = BigInt(s.value)
      const priced = value > 0n && !s.description.includes(formatEther(value))
      return `${s.description}. ${chain} transaction${priced ? `, ${formatEther(value)} ETH` : ''}.`
    }),
  }
}

/** Completes the steps for `from` and attaches the card: the tail of every write tool. */
export async function finish(
  env: Env,
  from: Address,
  result: Record<string, unknown> & { steps: Step[] },
  card: { action: CardAction; name: string; rows: [string, string][]; warnings?: string[]; url?: string }
) {
  await completeSteps(env, from, result.steps)
  return {
    ...result,
    signing:
      'Each step carries `transaction`, complete (nonce, gas, fees, chainId). With PayBox: request_wallet_sign {op: "transaction", transaction} unchanged, then hoodfi_send_transaction with the signed bytes. Wait for status "success" before the next step.',
    card: cardFor({
      action: card.action,
      name: card.name,
      wallet: from,
      rows: card.rows,
      warnings: card.warnings ?? [],
      url: card.url ?? nameLink(card.name),
      steps: result.steps,
    }),
  }
}

/* ------------------------------------------------------------- tools */

const TEXT_KEYS = [
  'avatar',
  'description',
  'url',
  'com.twitter',
  'com.github',
  'com.discord',
  'org.telegram',
  'email',
] as const

export const AGENT_TOOLS = [
  {
    name: 'hoodfi_list_names',
    title: 'List the hoodfi.eth names a wallet holds',
    description:
      'Every *.hoodfi.eth name an address currently holds (subnames included), and which one is its primary: the ENS primary name if one is set and resolves back, otherwise the shallowest, shortest name that resolves to it.',
    inputSchema: {
      type: 'object',
      properties: { address: { type: 'string', description: 'The wallet, 0x…' } },
      required: ['address'],
      additionalProperties: false,
    },
  },
  {
    name: 'hoodfi_build_set_text_tx',
    title: 'Set a name’s profile records',
    description: `Build the transaction that sets a name's profile (text) records: ${TEXT_KEYS.join(', ')}. Pass only the keys to change; "" clears one. Several keys are batched so the owner signs once. Works at any depth (subnames too). Only the name's owner can sign.`,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'gm, gm.hoodfi.eth, or a subname like jack.gm.hoodfi.eth' },
        address: { type: 'string', description: 'The owner wallet that will sign.' },
        records: {
          type: 'object',
          description: `Key → value. Keys: ${TEXT_KEYS.join(', ')}. avatar is an https:// or ipfs:// image URL. com.twitter is the handle without @.`,
          additionalProperties: { type: 'string' },
        },
      },
      required: ['name', 'address', 'records'],
      additionalProperties: false,
    },
  },
  {
    name: 'hoodfi_build_create_subnames_tx',
    title: 'Create subnames under a name you own',
    description:
      'Build the transaction that creates names beneath a name the signer owns — jack.gm.hoodfi.eth under gm.hoodfi.eth — at any depth, free (gas only), up to 20 in one signature. Each new name is pointed at its holder. Give a recipient to hand one to someone else; it is minted to the signer, its address set, then transferred, all in the same transaction.',
    inputSchema: {
      type: 'object',
      properties: {
        parent: { type: 'string', description: 'The name to create under, e.g. gm.hoodfi.eth' },
        address: { type: 'string', description: "The parent's owner, who signs." },
        subnames: {
          type: 'array',
          description: 'Up to 20.',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'The new label, e.g. "jack"' },
              recipient: { type: 'string', description: 'Optional 0x address to give it to. Omit to keep it.' },
            },
            required: ['label'],
            additionalProperties: false,
          },
        },
      },
      required: ['parent', 'address', 'subnames'],
      additionalProperties: false,
    },
  },
  {
    name: 'hoodfi_build_transfer_tx',
    title: 'Transfer a name to another wallet',
    description:
      "Build the transaction that transfers a hoodfi.eth name (an ERC-721 on Robinhood Chain) to another address. IRREVERSIBLE: confirm the recipient with the user before signing. The name's address records are NOT changed — it still resolves to the old wallet until the new owner updates it. Only the owner can sign.",
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The name to transfer.' },
        address: { type: 'string', description: 'The current owner, who signs.' },
        to: { type: 'string', description: 'The recipient, 0x…' },
      },
      required: ['name', 'address', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'hoodfi_build_set_primary_name_tx',
    title: 'Set a hoodfi name as your ENS primary name',
    description:
      "Build the transaction that makes a hoodfi.eth name the wallet's ENS primary name, so apps and explorers show it instead of 0x…. This is an Ethereum MAINNET transaction (ReverseRegistrar.setName), paid in mainnet ETH gas, sent from the wallet being named. The name must already resolve to that wallet (set it with hoodfi_build_set_address_tx first if not), or apps ignore the primary.",
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The name, any depth.' },
        address: { type: 'string', description: 'The wallet to name. It signs, on mainnet.' },
      },
      required: ['name', 'address'],
      additionalProperties: false,
    },
  },
  {
    name: 'hoodfi_send_transaction',
    title: 'Broadcast a signed transaction',
    description:
      'For wallets that sign without broadcasting, such as PayBox: pass the signed raw transaction (0x…) of a step prepared here and it is sent — on Robinhood Chain, or on mainnet for a primary name. Only HoodFi transactions are relayed: the registrar, the name registry, a USDG approval to the registrar, and the mainnet ReverseRegistrar. Waits for the receipt and reports its status.',
    inputSchema: {
      type: 'object',
      properties: { signed_transaction: { type: 'string', description: 'Signed raw transaction, 0x-prefixed hex.' } },
      required: ['signed_transaction'],
      additionalProperties: false,
    },
  },
] as const

/* ------------------------------------------------------------- list */

export async function listNames(args: Record<string, unknown>, env: Env) {
  const address = requireAddress(args.address)
  const path = `/owner/${address}/names`
  // A service binding: a Worker fetching another Worker on the same account over the
  // public hostname gets error 1042.
  const res = env.GATEWAY
    ? await env.GATEWAY.fetch(new Request(`https://hoodfi-gateway${path}`))
    : await fetch(`https://hoodfi-gateway.dmpay.workers.dev${path}`)
  if (!res.ok) throw new ToolError(UNREADABLE)
  const body = (await res.json()) as {
    primary: string | null
    primarySource?: string
    names: { name: string; addr: string | null; resolves: boolean }[]
  }
  // Structured fields only: no avatar or other record a stranger could have written.
  // A subname's label is one too, so names that are not mintable labels are withheld.
  const rule = { parent: PARENT, maxLabelLength: MAX_LABEL_LENGTH }
  const { listed, withheld } = splitListable(body.names, rule)
  const primary = body.primary && isListableName(body.primary, rule) ? body.primary : null
  return {
    address,
    primary,
    primarySource: primary ? (body.primarySource ?? null) : null,
    names: listed.map((n) => ({
      name: n.name,
      resolvesToThisWallet: n.resolves,
      url: nameLink(n.name),
    })),
    count: listed.length,
    ...(withheld > 0 || primary !== body.primary
      ? {
          withheld,
          ...(primary !== body.primary ? { primaryWithheld: true } : {}),
          withheldNote:
            'Names with characters a hoodfi.eth mint does not allow are not shown: anyone holding a parent name can create a subname in this wallet, so its text is not passed on.',
        }
      : {}),
  }
}

/* ------------------------------------------------------------- text */

export async function buildSetTextTx(args: Record<string, unknown>, env: Env) {
  const { name } = requireName(args.name)
  const address = requireAddress(args.address)
  const records = args.records
  if (!records || typeof records !== 'object' || Array.isArray(records))
    throw new ToolError('`records` must be an object of key → value.')
  const entries = Object.entries(records as Record<string, unknown>)
  if (entries.length === 0) throw new ToolError('Pass at least one record.')
  for (const [key, value] of entries) {
    if (!(TEXT_KEYS as readonly string[]).includes(key))
      throw new ToolError(`"${key}" is not a supported record. Supported: ${TEXT_KEYS.join(', ')}.`)
    if (typeof value !== 'string') throw new ToolError(`"${key}" must be a string ("" clears it).`)
    if (value.length > 1000) throw new ToolError(`"${key}" is over 1000 characters.`)
    if (key === 'avatar' && value && !/^(https:\/\/|ipfs:\/\/|eip155:)/.test(value))
      throw new ToolError('avatar must be an https://, ipfs:// or eip155: (NFT) URI.')
  }

  const client = robinhoodClient(env)
  const registry = envVar('L2_REGISTRY_ADDRESS', env)
  const node = await requireOwner(client, registry, name, address)

  const calls = entries.map(([key, value]) =>
    encodeFunctionData({ abi: registryAbi, functionName: 'setText', args: [node, key, (value as string).trim()] })
  )
  const data =
    calls.length === 1
      ? (calls[0] as Hex)
      : encodeFunctionData({ abi: registryAbi, functionName: 'multicall', args: [calls] })

  const changed = entries.map(([k, v]) => `${k} ${(v as string) ? 'set' : 'cleared'}`).join(', ')
  return finish(
    env,
    address,
    {
      name,
      owner: address,
      sets: Object.fromEntries(entries),
      steps: [{ description: `Set ${changed} on ${name}`, to: registry, data, value: '0x0', chainId: ROBINHOOD_CHAIN_ID }],
      note: 'Records resolve through CCIP-Read, so they answer on mainnet ENS too. Wallets cache for a few minutes.',
    },
    {
      action: 'records',
      name,
      rows: entries.map(([k, v]) => [k, (v as string) ? (v as string).slice(0, 60) : 'cleared'] as [string, string]),
    }
  )
}

/* ------------------------------------------------------------- subnames */

function subnodeOf(parentNode: Hex, label: string): Hex {
  const labelhash = keccak256(new TextEncoder().encode(label))
  return keccak256(`0x${parentNode.slice(2)}${labelhash.slice(2)}`)
}

export async function buildCreateSubnamesTx(args: Record<string, unknown>, env: Env) {
  const { name: parent } = requireName(args.parent)
  const address = requireAddress(args.address)
  if (!Array.isArray(args.subnames) || args.subnames.length === 0)
    throw new ToolError('`subnames` must be a non-empty array.')
  if (args.subnames.length > 20) throw new ToolError('At most 20 subnames per transaction.')

  const rows = args.subnames.map((raw, i) => {
    const row = raw as { label?: unknown; recipient?: unknown }
    const check = checkLabel(String(row.label ?? ''))
    if (!check.ok) throw new ToolError(`Subname ${i + 1}: ${check.reason}`)
    const recipient =
      row.recipient === undefined || row.recipient === '' ? null : requireAddress(row.recipient, `subnames[${i}].recipient`)
    return { label: check.label, recipient: recipient && recipient !== address ? recipient : null }
  })
  const dupes = rows.map((r) => r.label).filter((l, i, all) => all.indexOf(l) !== i)
  if (dupes.length) throw new ToolError(`Listed twice: ${[...new Set(dupes)].join(', ')}.`)

  const client = robinhoodClient(env)
  const registry = envVar('L2_REGISTRY_ADDRESS', env)
  const parentNode = await requireOwner(client, registry, parent, address)

  const existing = await client
    .multicall({
      contracts: rows.map((r) => ({
        address: registry,
        abi: registryAbi,
        functionName: 'owner' as const,
        args: [subnodeOf(parentNode, r.label)] as const,
      })),
      allowFailure: false,
      batchSize: 0,
    })
    .catch(() => {
      throw new ToolError(UNREADABLE)
    })
  const taken = rows.filter((_, i) => existing[i] !== ZERO).map((r) => `${r.label}.${parent}`)
  if (taken.length) throw new ToolError(`Already exist: ${taken.join(', ')}.`)

  // The site's order (frontend/lib/subnames.ts): mint to self, point it at its holder
  // while we still own it, then hand it over. registry.multicall delegatecalls into the
  // registry, so msg.sender stays the parent's owner throughout.
  const calls: Hex[] = []
  for (const r of rows) {
    const subnode = subnodeOf(parentNode, r.label)
    const holder = r.recipient ?? address
    const setRecords = [60n, ROBINHOOD_COIN_TYPE].map((coinType) =>
      encodeFunctionData({ abi: registryAbi, functionName: 'setAddr', args: [subnode, coinType, holder] })
    )
    calls.push(
      encodeFunctionData({ abi: registryAbi, functionName: 'createSubnode', args: [parentNode, r.label, address, setRecords] })
    )
    if (r.recipient)
      calls.push(
        encodeFunctionData({ abi: registryAbi, functionName: 'transferFrom', args: [address, r.recipient, BigInt(subnode)] })
      )
  }
  const data =
    calls.length === 1
      ? (calls[0] as Hex)
      : encodeFunctionData({ abi: registryAbi, functionName: 'multicall', args: [calls] })

  const created = rows.map((r) => ({ name: `${r.label}.${parent}`, holder: r.recipient ?? address }))
  return finish(
    env,
    address,
    {
      parent,
      creates: created,
      steps: [
        {
          description: `Create ${created.length} subname${created.length > 1 ? 's' : ''} under ${parent}`,
          to: registry,
          data,
          value: '0x0',
          chainId: ROBINHOOD_CHAIN_ID,
        },
      ],
      note: 'Free apart from gas. Each new name resolves to its holder straight away. Subnames are lifetime ERC-721s like their parent.',
    },
    {
      action: 'subnames',
      name: parent,
      rows: [
        ...created.slice(0, 6).map((c) => [c.name, c.holder === address ? 'yours' : `→ ${c.holder.slice(0, 6)}…${c.holder.slice(-4)}`] as [string, string]),
        ...(created.length > 6 ? [[`+${created.length - 6} more`, ''] as [string, string]] : []),
        ['Cost', 'gas only'],
      ],
    }
  )
}

/* ------------------------------------------------------------- transfer */

export async function buildTransferTx(args: Record<string, unknown>, env: Env) {
  const { name } = requireName(args.name)
  const address = requireAddress(args.address)
  const to = requireAddress(args.to, 'to')
  if (to === address) throw new ToolError('The recipient already owns it — that is the signing wallet.')

  const client = robinhoodClient(env)
  const registry = envVar('L2_REGISTRY_ADDRESS', env)
  const node = await requireOwner(client, registry, name, address)

  const [code, ethAddr] = await Promise.all([
    client.getCode({ address: to }).catch(() => undefined),
    client
      .readContract({ address: registry, abi: registryAbi, functionName: 'addr', args: [node, 60n] })
      .catch(() => null),
  ])
  const warnings = [`Transfers are irreversible. Confirm ${to} is right before signing.`]
  if (code && code !== '0x')
    warnings.push(
      `${to} is a contract on Robinhood Chain. Unless it can handle ERC-721 tokens (a Safe can), the name may be stuck there for good.`
    )
  const pointsHere = typeof ethAddr === 'string' && ethAddr.length >= 42 && getAddress(`0x${ethAddr.slice(-40)}`) === address
  if (pointsHere)
    warnings.push(`${name} still resolves to ${address}. Payments to the name keep going to this wallet until the new owner updates its address.`)

  return finish(
    env,
    address,
    {
      name,
      from: address,
      to,
      steps: [
        {
          description: `Transfer ${name} to ${to}`,
          to: registry,
          data: encodeFunctionData({ abi: registryAbi, functionName: 'transferFrom', args: [address, to, BigInt(node)] }),
          value: '0x0',
          chainId: ROBINHOOD_CHAIN_ID,
        },
      ],
      warnings,
    },
    { action: 'transfer', name, rows: [['From', address], ['To', to]], warnings }
  )
}

/* ------------------------------------------------------------- primary */

export async function buildSetPrimaryNameTx(args: Record<string, unknown>, env: Env) {
  const { name } = requireName(args.name)
  const address = requireAddress(args.address)
  const client = mainnetClient(env)

  // A primary name only shows when both directions agree. This is the same Universal
  // Resolver lookup (through CCIP-Read) an app runs to verify a primary.
  let forward: Address | null
  try {
    forward = await client.getEnsAddress({ name })
  } catch {
    throw new ToolError(`Could not resolve ${name} on mainnet right now, so it can't be checked. Try again shortly.`)
  }
  if (!forward || getAddress(forward) !== address)
    throw new ToolError(
      `${name} resolves to ${forward ?? 'nothing'} on mainnet, not ${address}, so apps would ignore it as a primary name. Point it at ${address} first with hoodfi_build_set_address_tx (ethereum: "${address}").`
    )

  let current: string | null | undefined
  try {
    current = await client.getEnsName({ address })
  } catch {
    current = undefined // unknown, not "none"
  }
  if (current === name) throw new ToolError(`${name} is already ${address}'s primary name.`)

  const balance = await client.getBalance({ address }).catch(() => null)
  const warnings: string[] = []
  if (balance === 0n)
    warnings.push(`${address} has no ETH on Ethereum mainnet. This transaction needs a little for gas.`)

  return finish(
    env,
    address,
    {
      name,
      address,
      replaces: current ?? null,
      steps: [
        {
          description: `Set ${address}'s ENS primary name to ${name}`,
          to: REVERSE_REGISTRAR,
          data: encodeFunctionData({ abi: reverseRegistrarAbi, functionName: 'setName', args: [name] }),
          value: '0x0',
          chainId: MAINNET_CHAIN_ID,
        },
      ],
      warnings,
      note: 'An Ethereum mainnet transaction, paid in mainnet ETH gas, sent from the wallet being named.',
    },
    {
      action: 'primary',
      name,
      rows: [
        ['Replaces', current === undefined ? 'unknown' : (current ?? 'none')],
        ['Network', 'Ethereum mainnet'],
      ],
      warnings,
    }
  )
}

/* ------------------------------------------------------------- relay */

const STALE =
  /nonce too low|replacement transaction underpriced|max fee per gas less than block base fee|fee cap less than block base fee/i

/** What a relayed transaction does, or null when it isn't one this server builds. */
function allowed(chainId: number, to: Address | null, data: Hex, env: Env): string | null {
  if (!to) return null
  const target = to.toLowerCase()
  // Compare lowercase. Never `.map(getAddress)`: map passes the index as getAddress's
  // chainId and every entry after the first stops matching (the Bot Names relay bug).
  if (chainId === MAINNET_CHAIN_ID)
    return target === REVERSE_REGISTRAR.toLowerCase() ? 'set primary name' : null
  if (chainId !== ROBINHOOD_CHAIN_ID) return null
  if (target === envVar('REGISTRAR_ADDRESS', env).toLowerCase()) {
    try {
      const { functionName } = decodeFunctionData({ abi: registrarAbi, data })
      return functionName === 'register' || functionName === 'registerWithUsdc' ? 'register' : null
    } catch {
      return null
    }
  }
  // Every registry write is owner-guarded on chain; relaying one grants nothing.
  if (target === envVar('L2_REGISTRY_ADDRESS', env).toLowerCase()) return 'name registry'
  if (target === envVar('USDG_ADDRESS', env).toLowerCase()) {
    try {
      const { functionName, args } = decodeFunctionData({ abi: erc20Abi, data })
      return functionName === 'approve' &&
        (args?.[0] as string).toLowerCase() === envVar('REGISTRAR_ADDRESS', env).toLowerCase()
        ? 'approve USDG'
        : null
    } catch {
      return null
    }
  }
  return null
}

export async function sendTransaction(args: Record<string, unknown>, env: Env) {
  const raw = typeof args.signed_transaction === 'string' ? (args.signed_transaction.trim() as Hex) : null
  if (!raw || !isHex(raw) || raw.length < 100)
    throw new ToolError('`signed_transaction` must be a signed raw transaction in 0x-prefixed hex.')
  let parsed
  try {
    parsed = parseTransaction(raw)
  } catch {
    throw new ToolError('That is not a valid signed transaction.')
  }
  if (!parsed.r || !parsed.s) throw new ToolError('The transaction is not signed.')
  const chainId = parsed.chainId ?? 0
  const what = allowed(chainId, parsed.to ? getAddress(parsed.to) : null, parsed.data ?? '0x', env)
  if (!what)
    throw new ToolError(
      `HoodFi only broadcasts the transactions it prepares (registrar, name registry, USDG approval, mainnet primary name). Send this one another way. chain ${chainId}, to ${parsed.to}.`
    )

  const client = clientFor(chainId, env)
  const hash = keccak256(raw)
  try {
    await client.request({ method: 'eth_sendRawTransaction', params: [raw] })
  } catch (error) {
    const msg = error instanceof Error ? (error as { details?: string }).details ?? error.message.split('\n')[0] ?? '' : String(error)
    // Node wording varies, so also ask the chain: a nonce below the sender's mined
    // count can never land, and waiting for its receipt would just time out.
    const usedNonce = await recoverTransactionAddress({ serializedTransaction: raw as TransactionSerialized })
      .then((sender) => client.getTransactionCount({ address: sender, blockTag: 'latest' }))
      .then((mined) => parsed.nonce !== undefined && parsed.nonce < mined)
      .catch(() => false)
    const stale = usedNonce || STALE.test(msg)
    const known =
      /already known|known transaction/i.test(msg) ||
      (stale && (await client.getTransaction({ hash }).catch(() => null)))
    if (!known)
      throw new ToolError(
        stale
          ? 'This transaction went stale (its nonce was used, or fees rose past its cap). Call the same build tool again for a fresh one and sign that.'
          : `The node rejected the transaction: ${msg.slice(0, 200)}`
      )
  }

  const explorer =
    chainId === MAINNET_CHAIN_ID ? `https://etherscan.io/tx/${hash}` : `${ROBINHOOD_EXPLORER}/tx/${hash}`
  try {
    // waitForTransactionReceipt resolves on a revert too: the status is the answer.
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 90_000 })
    return {
      hash,
      what,
      chainId,
      status: receipt.status,
      block: Number(receipt.blockNumber),
      explorer,
      ...(receipt.status === 'success' ? {} : { error: 'The transaction was mined but reverted.' }),
    }
  } catch {
    return { hash, what, chainId, status: 'pending', explorer, next: 'Broadcast, not mined within 90 s. Check the explorer before the next step.' }
  }
}

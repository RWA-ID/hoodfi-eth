import { type Address, type Hex, getAddress, namehash, parseAbiItem, parseUnits } from 'viem'

import { type Card } from './card'
import { ETH_COIN_TYPE, ROBINHOOD_COIN_TYPE, robinhoodClient } from './chain'
import { BTC_COIN_TYPE, COINS, SOL_COIN_TYPE } from './coins'
import { registryAbi } from './contracts'
import { type Env, envVar } from './env'
import { ToolError } from './errors'
import { nameLink, requireName } from './agent-tools'
import { recentChange } from './recent-changes'

/**
 * Sending crypto to a hoodfi name.
 *
 * This server moves nothing and builds no transaction here: it reads the address the
 * name holds for the chosen chain straight from the L2 registry on Robinhood Chain —
 * the source of truth, no gateway and no CCIP hop in between — and hands back the
 * arguments for PayBox's own `request_transfer`, which builds and sends the transfer.
 * `hoodfi_send_transaction` is not involved, so its allowlist stays as it is.
 *
 * Bitcoin is looked up because reading a record is free, but PayBox can't send it yet.
 */

const UNREADABLE =
  'Could not read Robinhood Chain right now: the read failed rather than coming back empty, so this says nothing either way. Try again shortly.'

const ZERO = '0x0000000000000000000000000000000000000000'

export const SEND_CHAINS = {
  ethereum: { symbol: 'ETH', label: 'Ethereum mainnet', decimals: 18, caip2: 'eip155:1', coinType: ETH_COIN_TYPE, coin: COINS.ethereum, paybox: true },
  robinhood: { symbol: 'ETH', label: 'Robinhood Chain', decimals: 18, caip2: 'eip155:4663', coinType: ROBINHOOD_COIN_TYPE, coin: COINS.ethereum, paybox: true },
  solana: { symbol: 'SOL', label: 'Solana', decimals: 9, caip2: 'solana:mainnet', coinType: SOL_COIN_TYPE, coin: COINS.solana, paybox: true },
  bitcoin: { symbol: 'BTC', label: 'Bitcoin', decimals: 8, caip2: 'bip122:000000000019d6689c085ae165831e93', coinType: BTC_COIN_TYPE, coin: COINS.bitcoin, paybox: false },
} as const
export type SendChain = keyof typeof SEND_CHAINS

/**
 * About two days of Robinhood Chain blocks (0.1 s each, measured 2026-10-23). A
 * topic-filtered getLogs over this range answers in well under a second.
 */
const RECENT_BLOCKS = 1_800_000n
const ADDRESS_CHANGED = parseAbiItem('event AddressChanged(bytes32 indexed node, uint256 coinType, bytes newAddress)')
const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)')

export const SEND_TOOL = {
  name: 'hoodfi_prepare_send',
  title: 'Send crypto to a hoodfi name',
  description:
    'Prepare sending ETH or SOL to a hoodfi.eth name (any depth, e.g. "gm" or "jack.gm.hoodfi.eth"). Reads the address the name holds for the chosen chain directly from the HoodFi registry on Robinhood Chain and returns the exact arguments for PayBox request_transfer, which builds and sends the transfer; this server moves nothing. Chains: "ethereum" (ETH on Ethereum mainnet), "robinhood" (ETH on Robinhood Chain), "solana" (SOL), "bitcoin" (look-up only: PayBox cannot send BTC yet). Refuses a name that has not been minted, and a name with no address for the chosen chain; it never substitutes another chain\'s address. Show the user the name, the full address and the amount, and send only after they confirm.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'The name to pay, with or without the .hoodfi.eth suffix. Subnames too.' },
      chain: { type: 'string', enum: Object.keys(SEND_CHAINS), description: 'Where to send: ethereum, robinhood, solana, or bitcoin (look-up only).' },
      amount: { type: 'string', description: 'How much, in the coin itself, as a decimal string, e.g. "0.01".' },
      from: { type: 'string', description: 'Optional: the PayBox wallet sending it (0x… for ETH, the Solana address for SOL); used to catch a send to yourself.' },
    },
    required: ['name', 'chain', 'amount'],
    additionalProperties: false,
  },
} as const

function requireChain(value: unknown): SendChain {
  if (typeof value !== 'string' || !(value in SEND_CHAINS))
    throw new ToolError(`\`chain\` must be one of: ${Object.keys(SEND_CHAINS).join(', ')}.`)
  return value as SendChain
}

/** "0.01" → the coin's smallest unit (wei, lamports, sats). A float would round. */
function requireAmount(value: unknown, chain: SendChain): { value: string; units: bigint } {
  const { decimals, symbol } = SEND_CHAINS[chain]
  const v = typeof value === 'string' ? value.trim() : ''
  if (!new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`).test(v))
    throw new ToolError(`\`amount\` must be an amount of ${symbol} as a decimal string with at most ${decimals} decimals, like "0.01".`)
  const units = parseUnits(v, decimals)
  if (units <= 0n) throw new ToolError('`amount` must be more than zero.')
  return { value: v, units }
}

export async function prepareSend(args: Record<string, unknown>, env: Env) {
  const { name } = requireName(args.name)
  const chain = requireChain(args.chain)
  const c = SEND_CHAINS[chain]
  const amount = requireAmount(args.amount, chain)
  const client = robinhoodClient(env)
  const registry = envVar('L2_REGISTRY_ADDRESS', env)
  const node = namehash(name)

  // The other EVM record rides along so a name whose two ETH records disagree is caught.
  const sibling = chain === 'ethereum' ? ROBINHOOD_COIN_TYPE : chain === 'robinhood' ? ETH_COIN_TYPE : null
  let owner: Address, stored: Hex, siblingStored: Hex
  try {
    const [o, a, s] = await client.multicall({
      contracts: [
        { address: registry, abi: registryAbi, functionName: 'owner', args: [node] },
        { address: registry, abi: registryAbi, functionName: 'addr', args: [node, c.coinType] },
        { address: registry, abi: registryAbi, functionName: 'addr', args: [node, sibling ?? c.coinType] },
      ],
      allowFailure: false,
    })
    ;[owner, stored, siblingStored] = [o as Address, a as Hex, s as Hex]
  } catch {
    // allowFailure: false, so a dead connection and a revert both land here — neither is "no record".
    throw new ToolError(UNREADABLE)
  }
  if (owner === ZERO)
    throw new ToolError(`${name} has not been minted, so it has no addresses. Don't send to it.`)

  const address = stored && stored !== '0x' ? c.coin.decode(stored) : null
  if (stored && stored !== '0x' && !address)
    throw new ToolError(`${name}'s ${c.coin.label} record isn't a valid ${c.symbol} address, so it can't be paid on ${c.label}.`)
  if (!address || address === ZERO) {
    const other = sibling && siblingStored && siblingStored !== '0x' ? COINS.ethereum.decode(siblingStored) : null
    throw new ToolError(
      `${name} has no ${c.label} address set, so it can't be paid there. Don't send it to any of its other addresses instead.` +
        (other ? ` It does have an address for ${chain === 'ethereum' ? 'Robinhood Chain' : 'Ethereum mainnet'}; the owner should set both.` : '')
    )
  }

  const warnings: string[] = []
  if (sibling && siblingStored && siblingStored !== '0x') {
    const other = COINS.ethereum.decode(siblingStored)
    if (other && other !== address)
      warnings.push(
        `${name}'s two ETH records disagree: ${c.label} → ${address}, ${chain === 'ethereum' ? 'Robinhood Chain' : 'Ethereum mainnet'} → ${other}. This send uses the ${c.label} one; confirm it with the recipient.`
      )
  }
  try {
    const latest = await client.getBlockNumber()
    const fromBlock = latest > RECENT_BLOCKS ? latest - RECENT_BLOCKS : 0n
    const [changed, moved] = await Promise.all([
      client.getLogs({ address: registry, event: ADDRESS_CHANGED, args: { node }, fromBlock, toBlock: latest }),
      client.getLogs({ address: registry, event: TRANSFER, args: { tokenId: BigInt(node) }, fromBlock, toBlock: latest }),
    ])
    // Judged per transaction: the mint's own transaction (its address records, a
    // partner sale's handover) is neither, anything after it is. See recent-changes.ts.
    const recent = recentChange(moved, changed, c.coinType)
    if (recent === 'changed-hands')
      warnings.push(`${name} changed hands in the last two days. Confirm the address with the recipient before sending.`)
    else if (recent === 'address-changed')
      warnings.push(`${name}'s ${c.label} address was changed in the last two days. Confirm it with the recipient before sending.`)
  } catch {
    warnings.push(`Couldn't check whether ${name}'s address changed recently.`)
  }
  const self = typeof args.from === 'string' ? args.from.trim() : ''
  if (self && (c.symbol === 'ETH' ? self.toLowerCase() === address.toLowerCase() : self === address))
    warnings.unshift(`${name} points at the sending wallet itself, so this would send ${c.symbol} to yourself.`)

  const display = `${amount.value} ${c.symbol}`
  const request = c.paybox ? { chain: c.caip2, to: address, amount: amount.units.toString(), token: null } : null
  const card: Card = {
    action: 'send',
    name,
    wallet: self,
    rows: [
      ['You send', display],
      ['To', address],
      ['On', c.label],
    ],
    steps: [
      c.paybox
        ? `PayBox sends ${display} to ${name} (${address}) on ${c.label}. Your wallet pays the network fee.`
        : `PayBox can't send Bitcoin yet. Pay ${address} from a Bitcoin wallet.`,
    ],
    warnings,
    url: nameLink(name),
    prompt: c.paybox ? `Send ${display} to ${name} (${address}) on ${c.label} with my PayBox wallet, exactly as prepared.` : undefined,
  }
  return {
    action: 'send',
    name,
    chain,
    symbol: c.symbol,
    address: chain === 'solana' || chain === 'bitcoin' ? address : getAddress(address),
    owner: getAddress(owner),
    amount: { value: amount.value, smallest_units: amount.units.toString() },
    sendable_with_paybox: c.paybox,
    paybox_request_transfer: request,
    next: c.paybox
      ? `Show the user ${name} → ${address} and ${display} on ${c.label}, and wait for them to confirm. Then call PayBox request_transfer with credential_id (their ${chain === 'solana' ? 'Solana' : 'EVM'} wallet from list_credentials) and chain, to, amount and token exactly as given here. Poll get_request with its request_id until it finishes; never call request_transfer again for the same send. If PayBox refuses the chain, tell the user; don't switch to another chain.`
      : "PayBox can't send Bitcoin yet. Show the user the full address so they can pay it from another wallet, and have them check it character by character.",
    warnings,
    card,
  }
}

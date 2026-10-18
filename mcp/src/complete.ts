import {
  type Address,
  type Hex,
  createPublicClient,
  fallback,
  getAddress,
  http,
} from 'viem'
import { mainnet } from 'viem/chains'

import { ROBINHOOD_CHAIN_ID, robinhoodClient } from './chain'
import { type Env, envVarOptional } from './env'

/**
 * Turns a step into a transaction PayBox can sign as it stands.
 *
 * PayBox signs but does not fill in: handed `{to, value, data}` it has no nonce, and
 * the user ends up supplying one by hand (seen on the yournames.io and Bot Names
 * connectors, which return the same shape). So every step also carries
 * `transaction`, complete, in eth_signTransaction's wire format.
 *
 *   nonce — the sender's pending count on that chain, +1 for each earlier step on the
 *           same chain in the same reply (USDG approve, then register).
 *   gas   — estimated +25%. A step that depends on an unmined earlier one (register
 *           after approve) cannot be estimated yet, so it gets a fixed limit well above
 *           real use. Unused gas is not charged.
 *   fees  — max fee = 2 × the current base fee + tip, so a signature made a few
 *           minutes later still lands. EIP-1559 charges the real base fee; the max is
 *           only a cap. Robinhood Chain is an Arbitrum Orbit chain and takes type-2.
 */

export const MAINNET_CHAIN_ID = 1

/** Public mainnet RPCs, for the one mainnet write here (the ENS primary name). */
const MAINNET_RPCS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.drpc.org',
]

export function mainnetClient(env: Env) {
  const dedicated = envVarOptional('MAINNET_RPC_URL', env)
  return createPublicClient({
    chain: mainnet,
    transport: fallback(
      [dedicated, ...MAINNET_RPCS]
        .filter((url): url is string => Boolean(url))
        .map((url) => http(url, { retryCount: 1, timeout: 8_000 })),
      { rank: false }
    ),
  })
}

export function clientFor(chainId: number, env: Env) {
  return chainId === MAINNET_CHAIN_ID ? mainnetClient(env) : robinhoodClient(env)
}

export interface Step {
  description: string
  to: Address
  data: Hex
  /** Hex quantity, as the existing tools have always returned it. */
  value: Hex | string
  chainId: number
  [key: string]: unknown
}

export interface SignableTx {
  from: Address
  to: Address
  data: Hex
  value: Hex
  nonce: Hex
  gas: Hex
  maxFeePerGas: Hex
  maxPriorityFeePerGas: Hex
  chainId: Hex
  type: '0x2'
}

const FALLBACK_GAS: Record<number, bigint> = {
  [ROBINHOOD_CHAIN_ID]: 1_500_000n,
  [MAINNET_CHAIN_ID]: 150_000n,
}

const hex = (n: bigint | number) => `0x${n.toString(16)}` as Hex

/** Adds `from`, `nonce`, `gas` and a complete `transaction` to each step, in place. */
export async function completeSteps(
  env: Env,
  from: Address,
  steps: Step[]
): Promise<void> {
  const sender = getAddress(from)
  const byChain = new Map<number, Step[]>()
  for (const step of steps)
    byChain.set(step.chainId, [...(byChain.get(step.chainId) ?? []), step])

  await Promise.all(
    [...byChain].map(async ([chainId, list]) => {
      const client = clientFor(chainId, env)
      const [nonce, block, tip] = await Promise.all([
        client.getTransactionCount({ address: sender, blockTag: 'pending' }),
        client.getBlock({ blockTag: 'latest' }),
        client
          .estimateMaxPriorityFeePerGas()
          .catch(() => (chainId === MAINNET_CHAIN_ID ? 1_000_000_000n : 0n)),
      ])
      const maxFee = (block.baseFeePerGas ?? 0n) * 2n + tip

      await Promise.all(
        list.map(async (step, i) => {
          const value = BigInt(step.value)
          let gas: bigint
          try {
            // Only the first step on a chain runs against current state.
            if (i > 0) throw new Error('depends on an earlier step')
            gas =
              ((await client.estimateGas({
                account: sender,
                to: step.to,
                data: step.data,
                value,
              })) *
                125n) /
              100n
          } catch {
            gas = FALLBACK_GAS[chainId] ?? 500_000n
          }
          step.from = sender
          step.nonce = nonce + i
          step.gas = gas.toString()
          step.transaction = {
            from: sender,
            to: step.to,
            data: step.data,
            value: hex(value),
            nonce: hex(nonce + i),
            gas: hex(gas),
            maxFeePerGas: hex(maxFee),
            maxPriorityFeePerGas: hex(tip),
            chainId: hex(chainId),
            type: '0x2',
          } satisfies SignableTx
        })
      )
    })
  )
}

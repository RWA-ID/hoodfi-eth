import { parseAbiItem } from 'viem'

import { type Env, envVar, envVarOptional } from '../env'
import { mainnetClient } from '../rpc'

const donatedEvent = parseAbiItem(
  'event Donated(address indexed donor, uint256 numYears, uint256 ethPaid, uint256 newExpiry, uint256 creditsTotal, uint256 totalYears)'
)

/** HoodfiDonations v2 deploy block — nothing before it can hold a donation. */
const DEFAULT_DEPLOY_BLOCK = 25698544n

/**
 * The donation ledger, read from mainnet logs.
 *
 * This lives on the worker rather than in the browser because a wide `eth_getLogs`
 * needs an archive-capable endpoint, and the only way to give the browser one is to
 * publish the key in the bundle — `NEXT_PUBLIC_*` is inlined at build time. The worker
 * already holds MAINNET_RPC_URL as a secret, so proxying keeps the key private and
 * leaves nothing worth stealing in the client.
 *
 * Every row still carries its transaction hash, so the feed remains checkable against
 * Etherscan by anyone who doesn't want to take our word for it.
 */
export async function getDonations(env: Env): Promise<Response> {
  const address = envVar('DONATIONS_ADDRESS', env)
  const configured = envVarOptional('DONATIONS_DEPLOY_BLOCK', env)
  const fromBlock = configured ? BigInt(configured) : DEFAULT_DEPLOY_BLOCK

  try {
    const logs = await mainnetClient(env).getLogs({
      address,
      event: donatedEvent,
      fromBlock,
      toBlock: 'latest',
    })

    const donations = logs.map((log) => ({
      donor: log.args.donor,
      numYears: String(log.args.numYears ?? 0n),
      ethPaid: String(log.args.ethPaid ?? 0n),
      totalYears: String(log.args.totalYears ?? 0n),
      txHash: log.transactionHash,
      blockNumber: String(log.blockNumber),
    }))

    return Response.json(
      { donations },
      {
        headers: {
          // Short enough that a fresh donation shows up quickly, long enough that the
          // feed's 60s client poll doesn't bill an archive query every time.
          'Cache-Control': 'public, max-age=30, s-maxage=30',
        },
      }
    )
  } catch (error) {
    // Never an empty array on failure. An empty ledger and an unreachable one look
    // identical to the client, and "no donations yet" is the more believable lie —
    // which is exactly how this went unnoticed in the first place.
    console.error('donations getLogs failed:', error)
    return Response.json(
      { message: 'Could not read donation logs from mainnet' },
      { status: 502 }
    )
  }
}

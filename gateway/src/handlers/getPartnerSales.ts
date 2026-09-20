import { isAddress, parseAbiItem } from 'viem'

import { type Env, envVarOptional } from '../env'
import { robinhoodClient } from '../rpc'

const registrationEvent = parseAbiItem(
  'event PartnerRegistration(address indexed partner, address indexed buyer, bytes32 indexed node, string label, uint256 pricePaid, uint256 baseFee, uint256 partnerShare, uint256 platformCut)'
)

/** HoodfiPartnerRouter deploy block — nothing before it can hold a sale. */
const DEFAULT_DEPLOY_BLOCK = 68081151n

/**
 * A partner's sales, read from the router's own logs.
 *
 * On the worker for the same reason as the donation ledger: a wide `getLogs` needs an
 * archive-capable endpoint and the browser cannot be given one without inlining the key
 * into the bundle. Robinhood Chain adds a second reason — its public RPC answers POST
 * with a duplicated `access-control-allow-origin: *,*` that every browser rejects, so a
 * page cannot read these logs directly however the key is handled.
 *
 * `partner` is an indexed topic, so this filters at the node rather than pulling every
 * sale and discarding most of it. Every row carries its transaction hash: the dashboard's
 * numbers are the partner's to verify on the explorer, not ours to assert.
 */
export async function getPartnerSales(partner: string, env: Env): Promise<Response> {
  if (!isAddress(partner)) {
    return Response.json({ message: 'Not an address' }, { status: 400 })
  }

  const router = envVarOptional('PARTNER_ROUTER_ADDRESS', env)
  if (!router) {
    return Response.json({ message: 'Partner router not configured' }, { status: 503 })
  }
  const configured = envVarOptional('PARTNER_ROUTER_DEPLOY_BLOCK', env)
  const fromBlock = configured ? BigInt(configured) : DEFAULT_DEPLOY_BLOCK

  try {
    const logs = await robinhoodClient(env).getLogs({
      address: router as `0x${string}`,
      event: registrationEvent,
      args: { partner: partner as `0x${string}` },
      fromBlock,
      toBlock: 'latest',
    })

    const sales = logs.map((log) => ({
      label: log.args.label ?? '',
      buyer: log.args.buyer,
      pricePaid: String(log.args.pricePaid ?? 0n),
      baseFee: String(log.args.baseFee ?? 0n),
      partnerShare: String(log.args.partnerShare ?? 0n),
      txHash: log.transactionHash,
      blockNumber: String(log.blockNumber),
    }))

    // Totals here rather than in the browser so the dashboard cannot disagree with the
    // rows it is showing — one pass over one array, computed once.
    const totals = sales.reduce(
      (acc, s) => ({
        count: acc.count + 1,
        gross: acc.gross + BigInt(s.pricePaid),
        earned: acc.earned + BigInt(s.partnerShare),
      }),
      { count: 0, gross: 0n, earned: 0n }
    )

    return Response.json(
      {
        sales,
        totals: {
          count: totals.count,
          gross: String(totals.gross),
          earned: String(totals.earned),
        },
      },
      { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30' } }
    )
  } catch (error) {
    // Never an empty list on failure. A partner with no sales and an unreachable RPC look
    // identical to the client, and "no sales yet" is the more believable lie — which is
    // how the donation ledger's outage went unnoticed.
    console.error('partner sales getLogs failed:', error)
    return Response.json(
      { message: 'Could not read sales from Robinhood Chain' },
      { status: 502 }
    )
  }
}

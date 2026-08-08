import {
  encodeAbiParameters,
  getAddress,
  isAddress,
  keccak256,
  parseAbi,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import { ROBINHOOD_CHAIN_ID } from '../chains'
import { type Env, envVar } from '../env'
import { mainnetClient, robinhoodClient } from '../rpc'

/** How long a signed voucher stays valid. Short enough to bound staleness, long
 *  enough to survive a slow wallet confirmation. */
const VOUCHER_TTL_SECONDS = 30 * 60

const donationsAbi = parseAbi(['function shortCredits(address) view returns (uint256)'])
const registrarAbi = parseAbi(['function creditsSpent(address) view returns (uint256)'])

/**
 * Signs an attestation of how many short-name credits an address earned on mainnet,
 * letting HoodfiRegistrar on Robinhood Chain mint 1-3 character names without a bridge.
 *
 * The signature covers the *cumulative* total, which only ever grows, and the registrar
 * tracks how many the address already spent. That makes the voucher inherently
 * replay-safe: re-submitting an old one can never mint past the total it attested, so
 * no nonce or revocation list is needed.
 *
 * This endpoint attests only to public L1 state — anyone can verify it by reading
 * `HoodfiDonations.shortCredits(address)` themselves. It grants nothing that the
 * donation didn't already earn.
 */
export async function getVoucher(rawAddress: string, env: Env) {
  if (!isAddress(rawAddress)) {
    return Response.json({ message: 'Invalid address' }, { status: 400 })
  }
  const donor = getAddress(rawAddress)

  const donationsAddress = envVar('DONATIONS_ADDRESS', env)
  const registrarAddress = envVar('REGISTRAR_ADDRESS', env)

  let totalCredits: bigint
  try {
    totalCredits = await mainnetClient(env).readContract({
      address: donationsAddress,
      abi: donationsAbi,
      functionName: 'shortCredits',
      args: [donor],
    })
  } catch (error) {
    return Response.json(
      { message: 'Could not read donation credits from mainnet', error: String(error) },
      { status: 502 }
    )
  }

  if (totalCredits === 0n) {
    return Response.json(
      {
        donor,
        totalCredits: '0',
        message: 'No short-name credits. Donate a year to hoodfi.eth to earn one.',
      },
      { status: 404 }
    )
  }

  const expiry = BigInt(Math.floor(Date.now() / 1000) + VOUCHER_TTL_SECONDS)

  // Must match HoodfiRegistrar.voucherDigest exactly:
  //   toEthSignedMessageHash(keccak256(abi.encode(registrar, chainId, donor, total, expiry)))
  const inner = keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint256' },
      ],
      [registrarAddress, BigInt(ROBINHOOD_CHAIN_ID), donor, totalCredits, expiry]
    )
  )

  const account = privateKeyToAccount(envVar('SIGNER_PRIVATE_KEY', env))
  // viem's signMessage over a raw hash applies the EIP-191 prefix, matching
  // OpenZeppelin's MessageHashUtils.toEthSignedMessageHash on the contract side.
  const signature = await account.signMessage({ message: { raw: inner } })

  // Reported so the UI can show "2 of 3 credits left" without a second RPC round trip.
  // A failed read used to fall through as zero, which reads as "all your credits are
  // unspent" — the UI would then offer a free mint that reverts on submission. Report
  // the gap honestly instead and let the caller decide what to show.
  let spent: bigint | null = null
  try {
    spent = await robinhoodClient(env).readContract({
      address: registrarAddress,
      abi: registrarAbi,
      functionName: 'creditsSpent',
      args: [donor],
    })
  } catch (error) {
    // Non-fatal: the registrar enforces the real accounting on-chain regardless.
    console.error(`creditsSpent unreadable for ${donor}:`, error)
  }

  const available =
    spent === null ? null : totalCredits > spent ? totalCredits - spent : 0n

  return Response.json({
    donor,
    totalCredits: totalCredits.toString(),
    creditsSpent: spent === null ? null : spent.toString(),
    creditsAvailable: available === null ? null : available.toString(),
    expiry: expiry.toString(),
    signature,
    signer: account.address,
    registrar: registrarAddress,
    chainId: ROBINHOOD_CHAIN_ID,
  })
}

export { VOUCHER_TTL_SECONDS }

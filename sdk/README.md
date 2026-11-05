# @hoodfi/sdk

Resolve, reverse-look-up and register `*.hoodfi.eth` names on Robinhood Chain (chain id 4663).

HoodFi names are lifetime ENS subnames, minted as ERC-721s on Robinhood Chain. There are no renewals and there is no token. They also resolve on Ethereum through ENS (CCIP-Read), so any ENS-aware wallet already reads them. This SDK is for apps that want the details: one multicall per lookup, typed results, and errors that tell an outage apart from a "no".

Keyless: it reads public RPCs and builds unsigned transactions. You sign with your own wallet.

```sh
npm install @hoodfi/sdk viem
```

## Quick start

```ts
import { createHoodfiClient } from '@hoodfi/sdk'

const hoodfi = createHoodfiClient()

// Forward: everything a name holds
const profile = await hoodfi.resolve('gm') // or 'gm.hoodfi.eth'
profile?.owner
profile?.addresses.robinhood // also: ethereum, bitcoin, solana, xrp
profile?.records.avatar

// Paying a name: the record for THAT chain, or an error
const { address, warnings, caveat } = await hoodfi.getSendAddress('gm', 'robinhood')

// Reverse: which name to show for a wallet
const { primary, names } = await hoodfi.lookupAddress('0x…')

// Is it free, and what does it cost?
const check = await hoodfi.checkName('alice')
check.available, check.price.usdg // 3_000_000n = $3 (USDG, 6 decimals)
```

## Registering

```ts
import { createWalletClient, custom } from 'viem'
import { createHoodfiClient, robinhoodChain } from '@hoodfi/sdk'

const hoodfi = createHoodfiClient()
const wallet = createWalletClient({ chain: robinhoodChain, transport: custom(window.ethereum) })
const [account] = await wallet.getAddresses()

const { steps } = await hoodfi.buildRegistration({ name: 'alice', account, payWith: 'eth' })
for (const step of steps) {
  const hash = await wallet.sendTransaction({ account, to: step.to, data: step.data, value: step.value })
  const receipt = await hoodfi.publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`${step.description} reverted`)
}
```

- **The name goes to whoever sends the transaction.** The registrar mints to `msg.sender` and takes no recipient, so to give a name to someone else, mint it and then transfer it.
- `payWith: 'usdg'` adds an `approve` step first when the allowance is short.
- ETH payments send the quoted price plus a buffer (`overpayBps`, default 100 = 1%) so a price-feed tick between quote and send doesn't revert the transaction. The registrar refunds the excess to the sender in the same transaction.
- Prices: $3 for 4+ characters, $5 / $10 / $15 for 3 / 2 / 1 characters. `checkName` returns the live price.

## Errors

Every failure is a `HoodfiError` with a `code`:

| code | meaning |
| --- | --- |
| `INVALID_NAME` | Not a valid hoodfi name (or address). Nothing was read. |
| `NOT_REGISTERED` | `getSendAddress` on a name nobody holds. (`resolve` returns `null` instead.) |
| `NO_RECORD` | The name has no address for that chain. **Don't fall back to another chain's record.** |
| `UNAVAILABLE` | `buildRegistration` on a taken, reserved or paused name. |
| `UNREADABLE` | The RPC or API didn't answer. **This tells you nothing about the name.** Retry it, and never show it as "not registered" or "no names". |

## Things that bite

- **`gm.eth` is not `gm.hoodfi.eth`.** `resolve` and `getSendAddress` reject any `.eth` name outside `hoodfi.eth` rather than quietly reading the hoodfi name with the same label, which could belong to someone else entirely.
- **Robinhood Chain and Ethereum are separate records.** They normally hold the same address. `getSendAddress('x', 'robinhood')` never borrows the Ethereum record (or vice versa). A Safe or other contract wallet exists only on the chains it was deployed to, and funds sent to its address on another chain can be stuck.
- **Records don't follow the token.** After a name is sold, its address records still point at the seller until the new owner updates them. `lookupAddress` only names a wallet `primary` when the name resolves back to that wallet.
- **Solana addresses have no checksum**, and a classic XRP address carries no destination tag. `getSendAddress` returns a `caveat` for these; show it to the user.
- The Robinhood Chain coinType is `2147488311n`. In JavaScript, `0x80000000 | 4663` evaluates to a negative number, which silently reads nothing.

## Options

```ts
createHoodfiClient({
  rpcUrls: ['https://your-robinhood-rpc'], // tried before the public RPCs; recommended on servers
  publicClient,                            // or bring your own viem client (chain 4663)
  apiUrl: 'https://ccip.hoodfi-mcp.com',   // reverse-lookup API
  fetch,                                   // custom fetch
})
```

The public RPC rate-limits by IP. Servers doing volume should pass their own endpoint.

## Also exported

`checkLabel`, `checkHoodfiName`, `normalizeLabel`, `tierOf`, `fullName`, `decodeContenthash`, `CHAINS`, `CONTRACTS`, `robinhoodChain`, the coin-type constants, and the minimal `registrarAbi` / `registryAbi`.

## Related

- Integration guide: [docs/INTEGRATING.md](https://github.com/RWA-ID/hoodfi-eth/blob/main/docs/INTEGRATING.md)
- Drop-in mint widget: [`@hoodfi/widget`](https://www.npmjs.com/package/@hoodfi/widget)
- MCP server for AI agents: `https://hoodfi-mcp.com/mcp`
- Contracts and owners: [contracts/README.md](https://github.com/RWA-ID/hoodfi-eth/blob/main/contracts/README.md)

MIT

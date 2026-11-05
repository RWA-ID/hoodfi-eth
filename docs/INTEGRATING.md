# Integrating HoodFi Names

A one-page guide for wallets, launchpads, explorers and agents. Every endpoint below is
free and needs no API key. Source for all of it is in this repository (MIT).

`*.hoodfi.eth` names are ENS subnames. Each one is an ERC-721 on Robinhood Chain (4663), and
resolves from Ethereum mainnet through `HoodfiL1Resolver` over CCIP-Read (ENSIP-10 +
EIP-3668). Addresses are in [`contracts/README.md`](../contracts/README.md).

## 1. Name → address

Use your ENS library as you would for any `.eth` name. viem, ethers and wagmi follow the
`OffchainLookup` on their own:

```ts
const address = await mainnetClient.getEnsAddress({ name: 'gm.hoodfi.eth' })
```

### Sending funds: read the record for the chain you're sending on

This is the one rule HoodFi integrators most often get wrong.

| Sending on | Read | Notes |
|---|---|---|
| Robinhood Chain | `addr(node, 2147488311)` (ENSIP-11, `0x80000000 \| 4663`) | Never the one-argument `addr(node)`, which returns coinType 60 |
| Ethereum mainnet | `addr(node, 60)` | |
| Bitcoin / Solana / XRP Ledger | ENSIP-9 coinTypes 0 / 501 / 144 | Stored in each chain's binary encoding |

**Don't fall back to another chain's record when the one you need is empty.** A
key-held account has the same address on every EVM chain, but a contract wallet such as a
Safe exists only where it was deployed. Funds sent to its address on another chain can be
stuck. The registrar writes both EVM records at mint and hoodfi.name/manage writes them
together, so an empty record means someone wrote to the registry directly. In that case, ask
the recipient. The reference implementation is [`mcp/src/send-record.ts`](../mcp/src/send-record.ts),
with tests in `send-record.test.mjs`.

Checksums: only Bitcoin and XRP addresses carry one. A Solana address has no checksum, and an
Ethereum address is only verified when it has EIP-55 capitalisation. A classic XRP `r…`
address has no destination tag, which an exchange deposit needs.

## 2. Address → name

`getEnsName` returns a hoodfi name only for holders who set it as their ENS primary on
mainnet. Most holders never send a mainnet transaction, so use the reverse lookup
endpoint, which covers both cases:

```
GET https://ccip.hoodfi-mcp.com/owner/{address}/names
→ { address, primary, primarySource, names: [{ name, node, addr, resolves, avatar }] }
```

- `primary` is only ever a name whose ETH record resolves back to that address. An address
  can't claim someone else's name.
- `primarySource` is `"ens"` when the holder chose it, and `"inferred"` otherwise.
- A failed chain read returns a **502, never an empty list**. Keep showing the address and
  retry, and don't cache "no name". Responses are cached for 60 seconds, CORS is open.

Display order: in-app choice → ENS primary → `primary` → short address. The full response
format and the "respect the holder's primary" rule are in the root README under
[Reverse lookup](../README.md#reverse-lookup--showing-a-name-instead-of-0x).

## 3. Selling names: `@hoodfi/widget`

```html
<script src="https://unpkg.com/@hoodfi/widget/dist/widget.js"
        data-partner="0xYourManagingWallet" data-price="$5"></script>
```

No approval from us is needed. Call `HoodfiPartnerRouter.setPartner(price, name, payout)` once.
You set your own price in USDG, and the margin over the base fee accrues to `payout` as a pull
payment. Partner sales are 4+ character names only. Setup, options and theming are in
[`widget/README.md`](../widget/README.md).

To mint directly instead, `HoodfiRegistrar` exposes `status(label)` and `priceOf(label)`
for reads, and `register(label)` (ETH) and `registerWithUsdc(label)` (USDG) for minting. The
name is minted to the transaction sender, and there is no recipient argument.

## 4. Agents: MCP server

`https://hoodfi-mcp.com/mcp` (streamable HTTP) has 16 tools. They check and register names,
set records, subnames and the mainnet primary name, resolve a name to send to it, and send or
buy NFTs on Robinhood Chain. Write tools return unsigned, fully filled transactions, and the
server holds no keys. See [hoodfi.name/mcp](https://www.hoodfi.name/mcp/).

## Traps

- **Records don't follow the token.** The L2Registry has no transfer hook. After a
  secondary sale, `addr` still points at the **seller** until the buyer resets it. If you
  show secondary listings, prompt buyers to re-point their records. The partner router does
  this for its own sales.
- **Trust Wallet's non-ETH send screen** doesn't follow wildcard / CCIP resolution for
  offchain subnames. ETH addresses resolve everywhere.
- **Blocked labels.** A few infrastructure labels (`www`, `mcp`, `rpc`, `ens`, `eth`, …) are
  blocklisted on chain and can never be minted. `status()` returns `4` for them.

# hoodfi.eth — lifetime names on Robinhood Chain

**hoodfi.eth** is an ENS subname service on **Robinhood Chain** (chain id **4663**,
an Arbitrum-technology Ethereum L2, mainnet since July 2026). Names of 4 or more
characters mint publicly today, in one transaction, from $3.

Names of **1–3 characters** are premium inventory. Until hoodfi.eth's expiry is
funded **100 years** ahead (the year 2127) they can only be minted by donors
spending **short-name credits** — one credit per year donated to the parent name's
expiry on Ethereum. At the goal the owner opens them to everyone at tier prices;
credits keep minting them free, so they never lose their value.

Names like `blake.hoodfi.eth` are **lifetime ERC-721s**: no renewals, no fees, no
revocation, full owner control of records — resolvable in every ENS-aware wallet
and app through the ENS Universal Resolver.

> **Independent project.** Not affiliated with, endorsed by, or connected to
> Robinhood Markets, Inc.

---

## Live deployments

| Contract | Network | Address |
|---|---|---|
| `HoodfiDonations` v2 | Ethereum mainnet | [`0x588c597bA6a3685511617bCece8457ca7648c9c0`](https://etherscan.io/address/0x588c597bA6a3685511617bCece8457ca7648c9c0) (verified; deploy block 25698544) |
| `HoodfiL1Resolver` | Ethereum mainnet | [`0x37215Dd89D0Fd4ea0Dbce690bDe58490fB7f7cF2`](https://etherscan.io/address/0x37215Dd89D0Fd4ea0Dbce690bDe58490fB7f7cF2) (verified; live resolver for hoodfi.eth) |
| `L2Registry` (hoodfi.eth) | Robinhood Chain | [`0xf2bABA012244bdD7445129597350054E1B3aEe5C`](https://robinhoodchain.blockscout.com/address/0xf2bABA012244bdD7445129597350054E1B3aEe5C) |
| `HoodfiRegistrar` v2 | Robinhood Chain | [`0x56be5565acc823f4195c2cf3b9046C083633209a`](https://robinhoodchain.blockscout.com/address/0x56be5565acc823f4195c2cf3b9046C083633209a) |
| `L2RegistryFactory` | Robinhood Chain | `0x6bA501514244D42726b12Be9f19C13AA870692B1` |
| USDG (Paxos stablecoin) | Robinhood Chain | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| CCIP gateway | Cloudflare Workers | `https://hoodfi-gateway.dmpay.workers.dev/v1/{sender}/{data}.json` |
| Credit voucher signer | Cloudflare Workers | `https://hoodfi-gateway.dmpay.workers.dev/voucher/{address}` |
| ERC-721 metadata | Cloudflare Workers | `https://hoodfi-gateway.dmpay.workers.dev/nft/{tokenId}` |
| Token art (NFT image) | Cloudflare Workers | `https://hoodfi-gateway.dmpay.workers.dev/art/{label}.png` (generated 1000×1000) |
| Per-name share page | Cloudflare Workers | `https://www.hoodfi.name/{label}` → `/n/{label}` (per-name OG tags) |
| Per-name share card | Cloudflare Workers | `https://www.hoodfi.name/card/{label}.png` (generated 1200×630) |
| Donation ledger | Cloudflare Workers | `https://hoodfi-gateway.dmpay.workers.dev/donations` |
| Website | hosted + IPFS | `https://www.hoodfi.name` · `https://hoodfi.eth.limo` |

**`hoodfi.name/{label}` is a real URL** — a `vercel.json` rewrite maps it to the
gateway's share page, restricted to the `[a-z0-9-]{1,32}` charset the registrar
enforces. Vercel checks the filesystem before rewrites, so every real route wins;
the tradeoff is that an unknown single-segment path renders "available" rather
than 404ing. `/n/{label}` still resolves, so links shared before this keep working.

Three of those endpoints exist because the site is a **static export**, which can
serve only one HTML document per route. A crawler fetching `/search/?q=gm` sees
byte-identical markup for every name, so per-name cards need a route that renders
per request; and a wide `eth_getLogs` needs an archive-capable RPC, which the
browser can only be given by inlining the key into the bundle. Both jobs therefore
live on the worker, where the key is a secret. Every ledger row still carries its
transaction hash, so the feed stays checkable without trusting us.

The v1 contracts (`0x12c03c69…11cE2` donations, `0x75d61F7d…4f51` registrar) are
retired. The **L2Registry was not redeployed**, so every name minted under v1 —
and the NFT baseURI and CCIP wiring — carried over untouched.

Proven live: `test1000.hoodfi.eth` was minted on Robinhood Chain and resolves on
Ethereum mainnet via `viem.getEnsAddress()` through the Universal Resolver, both
before and after the v2 registrar swap.

## How it works

### Minting a name (open now)

1. **Search.** Availability is read live from `HoodfiRegistrar.status()` on
   Robinhood Chain — no waitlist, no allowlist.
2. **Mint.** One transaction in **ETH** or **USDG**, at the tier price below. The
   name is an ERC-721 that lands in your wallet immediately.
3. **Make it yours.** Set the address, avatar, X handle, link, bio and website straight
   on the L2Registry from `/manage`. The registrar has no say in it. Every change
   in the form saves as one `multicall`, so it costs a single signature however
   many records moved.
4. **Show it off.** `/search` renders any name's records for anyone, no wallet
   required, and `hoodfi.name/{name}` unfurls with a generated card. `/manage`
   previews that same card live against your unsaved draft.

Addresses cover **Ethereum and every EVM chain** from one `addr` record — a wallet
resolves against L1 whatever network it's on, and the address it gets is valid on
Base, Arbitrum, Polygon, Optimism and Robinhood Chain alike. **Bitcoin and Solana**
are separate ENSIP-9 coinType records, stored in each chain's own binary encoding
rather than as the text you typed.

A name can also **be** a website. The EIP-1577 `contenthash` record is editable from
`/manage` — paste an IPFS CID or an IPNS key and the name serves that site, the same
mechanism that serves hoodfi.eth itself. `/search` shows the record and a **Visit**
button for anyone looking the name up. The codec (`frontend/lib/contenthash.ts`,
IPFS and IPNS only) is hand-rolled rather than pulled from a dependency and has its
own regression test: `cd frontend && npm test`. Contenthash needs no gateway change —
the CCIP path forwards whatever record call it is given, and `HoodfiL1Resolver`
already advertises `0xbc1c58d1`.

| Length | Price | Availability |
|---|---|---|
| 1 character | $15 | credit holders only, until the 100-year goal |
| 2 characters | $10 | credit holders only, until the 100-year goal |
| 3 characters | $5 | credit holders only, until the 100-year goal |
| 4+ characters | $3 | public, now |

### Short-name credits

Donating a year to hoodfi.eth's expiry earns **one credit**, and one credit mints
any 1–3 character name **free**:

1. **Donate.** `HoodfiDonations.donate()` atomically calls the official
   `ETHRegistrarController.renew()` — hoodfi.eth's expiry moves the moment your
   transaction confirms. The contract has **no withdraw function and never holds
   funds**; anything above the live price is refunded in the same transaction.
   Credits accumulate in `shortCredits(address)` on mainnet.
2. **Spend.** The gateway reads that mainnet balance and signs a voucher; the
   registrar on Robinhood Chain verifies the signature and mints the short name
   free. **No bridge is involved** — the signature is the only thing that crosses.
   The voucher attests a *cumulative* total and the registrar tracks what was
   spent, so replaying an old voucher can never mint past what was earned.
3. **At the goal.** `finalize()` is a public marker once `totalYearsDonated ≥ 100`;
   the owner then calls `openShorts()` (one-way) and short names go on public sale
   at tier prices. Credits still mint them free afterwards.

### Label rules

`a–z`, `0–9`, hyphens (not leading/trailing), 1–32 characters onchain; public
minting requires 4+ until `openShorts()`. Infra labels (`www`, `api`, `hood`,
`robinhood`, …) are permanently blocklisted. Frontends should ENSIP-15-normalize
before submitting.

## Architecture

```
ETHEREUM MAINNET                              ROBINHOOD CHAIN (4663)
┌──────────────────────────┐                  ┌───────────────────────────┐
│ HoodfiDonations          │                  │ L2Registry (Durin)        │
│  donate(years)           │  gateway reads   │  ERC-721 subnames +       │
│   └─► official ENS       │  shortCredits    │  addr/text/contenthash    │
│       controller.renew() │  and SIGNS a     ├───────────────────────────┤
│  shortCredits[donor]     │  voucher         │ HoodfiRegistrar           │
│  finalize() at 100y      │ ───────────────► │  register() ETH / USDG    │
├──────────────────────────┤   (no bridge)    │  mintShortWithVoucher()   │
│ HoodfiL1Resolver         │                  │  openShorts() at the goal │
│  apex records ONCHAIN    │                  └───────────▲───────────────┘
│  *.hoodfi.eth → CCIP     │    EIP-3668           reads │ RPC
│  (ENSIP-10 wildcard)     │ ◄────────────► CF Worker ───┘
└──────────────────────────┘  signed responses
            ▲
ENS Universal Resolver (0xeEeE…EeEe) + batch gateways
→ *.hoodfi.eth resolves in every ENS-aware wallet and app
```

Resolution design notes:

- **Apex records live onchain on L1** inside `HoodfiL1Resolver` (PublicResolver-
  style storage + events). The hoodfi.eth website contenthash and address resolve
  with **zero gateway dependency**, including for legacy non-ENSIP-10 clients and
  eth.limo.
- **Subnames resolve via ENSIP-10 wildcard + EIP-3668 CCIP-Read.** The resolver
  emits `OffchainLookup` with a `stuffedResolveCall(name, data, chainId, registry)`
  payload; the gateway forwards the inner record call to the L2Registry's own
  onchain `resolve()` and returns a **signed** response the resolver verifies
  (`0x1900 ‖ resolver ‖ expires ‖ keccak(request) ‖ keccak(result)`, raw digest).
- `supportsInterface` advertises ENSIP-10 **and** the record profiles
  (`addr`, multicoin `addr`, `text`, `contenthash`) — ethers-based clients probe
  these before querying.
- The gateway accepts all three callData wire shapes seen in the wild:
  the resolver's `stuffedResolveCall`, tooling's `resolve(bytes,bytes)`
  (`0x9061b923`), and the legacy raw `abi.encode(name,data)` tuple. It answers
  GET (`/v1/{sender}/{data}.json`, `.json` optional) and POST.
- **The gateway signs answers, so it must never sign one it didn't get.** A
  reverting call is a real answer — an unminted name or an unsupported record —
  and is returned as signed empty bytes. A *transport* failure is not an answer,
  and returns 502 instead. Collapsing the two is not a small bug: a signed empty
  response verifies perfectly against the resolver, so every client caches a
  cryptographically valid "this name has no records" and the outage is invisible.
  That is precisely what happened on 2026-08-08, when the public RPC began
  rate-limiting the worker's shared egress IP and every hoodfi name silently
  stopped resolving in wallets while the records sat untouched on L2. The worker
  now uses a dedicated RPC with the public endpoints behind it via `fallback()`,
  and distinguishes the two failure modes by walking viem's error chain.

## Repository layout

| Path | What |
|---|---|
| `contracts/` | Foundry workspace. Vendored [Durin](https://github.com/namestonehq/durin) (MIT) with the hoodfi contracts in `src/hoodfi/` |
| `contracts/src/hoodfi/HoodfiDonations.sol` | Mainnet donations + short-name credit ledger |
| `contracts/src/hoodfi/HoodfiRegistrar.sol` | Robinhood Chain registrar: paid mints + voucher mints |
| `contracts/src/hoodfi/HoodfiL1Resolver.sol` | Mainnet apex + wildcard resolver |
| `contracts/src/hoodfi/LabelUtils.sol` | Shared label validation (mirrored in `frontend/lib/labels.ts`) |
| `contracts/scripts/hoodfi/` | Deploy scripts (donations / L2 stack / L1 resolver / `UpgradeRegistrar`) |
| `contracts/test/hoodfi/` | Unit + mainnet-fork tests, including a full rehearsal of the registrar upgrade |
| `gateway/` | Cloudflare Worker (Hono + viem): CCIP-Read gateway, credit-voucher signer, NFT metadata and token art, share pages and cards, donation ledger, analytics sink |
| `gateway/src/rpc.ts` | Shared clients. Dedicated RPC first, public endpoints behind it via `fallback()` — a public RPC rate-limits the worker's shared egress even when the same call works from a laptop |
| `gateway/src/ccip-read/query.ts` | Separates "the chain answered no" from "we couldn't reach the chain"; only the first is ever signed |
| `gateway/src/handlers/getVoucher.ts` | Reads `shortCredits` on L1, signs the voucher the registrar accepts |
| `gateway/src/handlers/getSharePage.ts` · `getNameCard.ts` | Per-name OG tags, and the 1200×630 card they point at (satori) |
| `gateway/src/handlers/getDonations.ts` | The donation ledger, read with the private archive RPC |
| `frontend/` | Next.js 16 static export → hosted + IPFS |
| `frontend/app/mint/` · `app/manage/` · `app/search/` | Search-and-mint, record editing for names you own, and the public name lookup |
| `frontend/components/MintPanel.tsx` | The search card: live status, tier pricing, credit vouchers |
| `frontend/components/SearchPanel.tsx` | Public lookup: reads the L2Registry directly, so it keeps working — and keeps telling the truth — when the gateway in front of it doesn't |
| `frontend/components/ProfileCard.tsx` | The shareable card, used read-only on `/search` and as a live draft preview on `/manage` |
| `frontend/lib/resolution.ts` | Mainnet resolution check and the mint-date lookup, shared by both pages |
| `frontend/vercel.json` | Rewrites `/{label}`, `/n/`, `/card/` onto the worker. Not `next.config` — `rewrites` there are unsupported under `output: export` |
| `DEPLOY.md` | The v2 deploy runbook, in the order it must be run |

## Contract reference

### `HoodfiDonations` (mainnet)

| Function | Access | Notes |
|---|---|---|
| `donate(uint256 numYears)` payable | anyone | Renews hoodfi.eth atomically via the official controller and credits `shortCredits[msg.sender]`; refunds all excess |
| `extend(uint256 numYears)` payable | anyone, forever | Renew without earning credits (pure support) |
| `finalize()` | anyone, once `totalYearsDonated ≥ 100` | Public marker that the goal is reached |
| `shortCredits(address)` view | — | Cumulative credits earned — what the gateway attests |
| `quote(uint256 numYears)` view | — | Live ETH cost from the ENS oracle |
| `nameExpires()` view | — | hoodfi.eth expiry straight from the .eth registrar |
| `goalReached()` / `yearsRemaining()` view | — | Progress against `GOAL_YEARS` (100) |

Events: `Donated(donor, numYears, ethPaid, newExpiry, credits, totalYears)`,
`GoalReached`, `Extended`.
Invariant: **contract balance is zero after every transaction** (no withdraw
function exists).

### `HoodfiRegistrar` (Robinhood Chain)

| Function | Access | Notes |
|---|---|---|
| `register(string label)` payable | anyone (4+ chars, or any length once shorts open) | Tier-priced ETH mint, excess refunded |
| `registerWithUsdc(string label)` | same | Tier-priced USDG (6 decimals), straight to treasury |
| `mintShortWithVoucher(string label, uint256 totalCredits, uint256 expiry, bytes sig)` | any credit holder, always | Free 1–3 character mint against a signed credit attestation |
| `status(string)` / `priceOf(string)` view | — | 0 available · 1 taken · 2 locked · 3 invalid · 4 blocked; (wei, usdg) prices |
| `creditsAvailable(address, uint256)` / `voucherDigest(...)` view | — | Reproduce the gateway's accounting and signing digest yourself |
| `openShorts()` | owner, one-way | Opens 1–3 character names to public sale at tier prices |
| `setPaused(bool)` / `setCreditSigner(address)` / `setBlocklist(bytes32[], bool)` | owner | Emergency stop, signer rotation, infra labels |
| `setPrices` / `setUsdc` / `setTreasury` / `withdraw` | owner / anyone (`withdraw` → treasury) | Ops |

Minting sets default forward addresses for ETH (coinType 60) and Robinhood Chain
(ENSIP-11 coinType `0x80000000 | 4663` = 2147488311). After minting, **owners
manage their own records directly on the L2Registry** (addr/text/contenthash) —
no permission from the registrar needed.

### `HoodfiL1Resolver` (mainnet)

ENSIP-10 `resolve(bytes,bytes)` routes apex queries to onchain storage
(self-staticcall dispatch) and subname queries to the gateway via
`OffchainLookup`. Owner functions: `setAddr` / `setText` / `setContenthash`
(apex records), `setUrl`, `setSigner`, `setL2Registry`.

## Development

```bash
# Contracts — unit tests (fast, no network)
cd contracts && forge test --match-path "test/hoodfi/*"

# + fork tests against the LIVE ENS controller
MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path "test/hoodfi/*"

# Gateway — typecheck, local run, signed-response smoke test (all 3 wire shapes)
cd gateway && bun install && bunx tsc --noEmit
SIGNER_PRIVATE_KEY=0x… L2_REGISTRY_ADDRESS=0x… bun src/index.ts   # terminal 1
bun scripts/smoke.ts                                              # terminal 2

# Frontend
cd frontend && npm install && npm run dev
npm test                                    # contenthash codec vectors
# production: npm run build → static export in out/ → bash pin.sh (needs PINATA_JWT)
```

`frontend/.env.local` (see `.env.example`): Reown project id, Pinata JWT, and the
deployed contract addresses (`NEXT_PUBLIC_*`). The UI degrades gracefully to a
pre-deploy state when addresses are unset.

### Local end-to-end resolution test

`gateway/scripts/e2e-local.ts` drives the full pipeline against two local anvil
chains (L1 + a chain-id-4663 L2) and a locally running gateway: it registers a
name on the L2, then resolves it through the L1 resolver's complete EIP-3668
loop, verifying the signed proof onchain.

## Deploy runbook

**[`DEPLOY.md`](DEPLOY.md) is the runbook**, in the order it has to run: both v2
contracts, the gateway secrets, the frontend env for each of the two deployment
targets, and the post-deploy checklist.

The upgrade path matters more than the deploy itself. `UpgradeRegistrar.s.sol`
deploys the new registrar, loads the blocklist, wires USDG, then calls
`addRegistrar(new)` **before** `removeRegistrar(old)` so there is never a window
with no authorized registrar — and it leaves the **L2Registry untouched**, which
is what preserves existing names, the NFT baseURI and the CCIP wiring.
`test/hoodfi/HoodfiRegistrar.fork.t.sol` rehearses the whole thing against live
chain state.

The website ships to two origins from one export: a conventional host and IPFS.
`NEXT_PUBLIC_SITE_URL` differs per build (share-card images must be same-origin to
be fetchable), while `NEXT_PUBLIC_CANONICAL_URL` is identical on both so the two
copies don't compete in search.

## Launch operations

When `totalYearsDonated` reaches 100:

```bash
cast send <donations> "finalize()"  --rpc-url mainnet    # public marker, anyone can call
cast send <registrar> "openShorts()" --rpc-url robinhood # owner, one-way
```

`openShorts()` cannot be undone. Credits keep minting short names free afterwards,
so nobody who donated loses anything by the sale opening.

## Trust model, stated honestly

| Component | Guarantee |
|---|---|
| Donations | Trustless. ETH goes to the official ENS controller inside the donor's own tx; the contract cannot hold funds. Progress = `nameExpires()` on the official .eth registrar. |
| Minted names | Seizure-proof ERC-721s. No admin burn/transfer exists; re-minting an existing name reverts. Owners set their own records. |
| Short-name credits | Earned onchain on L1 (`shortCredits`), readable by anyone. The gateway only *attests* that public value — it grants nothing a donation didn't already earn, and the registrar enforces spending on-chain. A compromised signer could mint short names, not touch existing ones. |
| CCIP gateway | **Trusted-signer**: a malicious gateway could misreport records to L1 clients, but cannot touch L2 ownership. Signer is rotatable (`setSigner`); upgrade path to Arbitrum storage-proof verification with no ABI change. |
| Registry admin | Can approve registrars (which can edit records, never seize names). Post-launch plan: move to a multisig; renouncing freezes the system permanently. |

Known client limitation (inherited from ENS wildcard architecture): Trust
Wallet's **non-ETH coin** send screen doesn't follow wildcard/CCIP resolution for
offchain subnames; ETH addresses resolve everywhere.

## Attribution & license

Built on [Durin](https://github.com/namestonehq/durin) by NameStone (MIT) —
`contracts/src/{L2Registry,L2RegistryFactory,L2Resolver,L1Resolver}.sol` and the
gateway skeleton are vendored from it; `HoodfiL1Resolver` is a modified fork.
Everything else in this repository is MIT as well (see `contracts/LICENSE`).

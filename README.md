# hoodfi.eth — names on Robinhood Chain, secured until the year 3026

**hoodfi.eth** is a community-funded ENS subname service on **Robinhood Chain**
(chain id **4663**, an Arbitrum-technology Ethereum L2, mainnet since July 2026).
Anyone can donate years to hoodfi.eth's expiry on Ethereum — every donated year is
one reserved subname slot — until the parent name is paid up **1,000 years**
(the year 3026). At the goal, donors claim their reserved names free on Robinhood
Chain, and public registration opens at a flat one-time price.

Names like `blake.hoodfi.eth` are **lifetime ERC-721s**: no renewals, no fees, no
revocation, full owner control of records — resolvable in every ENS-aware wallet
and app through the ENS Universal Resolver.

> **Independent project.** Not affiliated with, endorsed by, or connected to
> Robinhood Markets, Inc.

---

## Live deployments (2026-07-11)

| Contract | Network | Address |
|---|---|---|
| `HoodfiDonations` | Ethereum mainnet | [`0x12c03c69b0433fA0fD657D6F58B9871A54711cE2`](https://etherscan.io/address/0x12c03c69b0433fA0fD657D6F58B9871A54711cE2) (verified; deploy block 25511636) |
| `HoodfiL1Resolver` | Ethereum mainnet | [`0x37215Dd89D0Fd4ea0Dbce690bDe58490fB7f7cF2`](https://etherscan.io/address/0x37215Dd89D0Fd4ea0Dbce690bDe58490fB7f7cF2) (verified; live resolver for hoodfi.eth) |
| `L2Registry` (hoodfi.eth) | Robinhood Chain | [`0xf2bABA012244bdD7445129597350054E1B3aEe5C`](https://robinhoodchain.blockscout.com/address/0xf2bABA012244bdD7445129597350054E1B3aEe5C) |
| `HoodfiRegistrar` | Robinhood Chain | [`0x75d61F7d87C5A0F4a52Fe526642c80d0Ef994f51`](https://robinhoodchain.blockscout.com/address/0x75d61F7d87C5A0F4a52Fe526642c80d0Ef994f51) |
| `L2RegistryFactory` | Robinhood Chain | `0x6bA501514244D42726b12Be9f19C13AA870692B1` |
| USDG (Paxos stablecoin) | Robinhood Chain | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| CCIP gateway | Cloudflare Workers | `https://hoodfi-gateway.dmpay.workers.dev/v1/{sender}/{data}.json` |

Proven live: `test1000.hoodfi.eth` was minted on Robinhood Chain and resolves on
Ethereum mainnet via `viem.getEnsAddress()` through the Universal Resolver.

## How it works

### For donors (pre-launch, open now)

1. **Donate years.** Pick N years; the site quotes ENS's live renewal price
   (~$5/year for hoodfi.eth, priced by ENS's own oracle). Your transaction calls
   `HoodfiDonations.donate()`, which **atomically** calls the official
   `ETHRegistrarController.renew()` — hoodfi.eth's expiry moves the moment your
   transaction confirms. The contract has **no withdraw function and never holds
   funds**; anything above the live price is refunded to you in the same
   transaction.
2. **Reserve names.** Every donated year = 1 slot. Spend slots on specific names
   (4+ characters) during the donation or any time later. First come, first
   served, recorded onchain, public via `NameReserved` events.
3. **Snapshot at 1,000 years.** Anyone can call `finalize()` once
   `totalYearsDonated ≥ 1000`. Reservations freeze. `extend()` remains open
   forever for further renewal donations (no slots).
4. **Claim free.** The reservation set is copied to the L2 registrar (verifiable
   by anyone against the L1 logs — see [`scripts/export-reservations.mjs`](scripts/export-reservations.mjs)),
   claims open, and donors mint their names for nothing but L2 gas.

### For everyone else (public sale, right after claims open)

One-time, lifetime prices — payable in **ETH** or **USDG**:

| Length | Price |
|---|---|
| 1 character | $15 |
| 2 characters | $10 |
| 3 characters | $5 |
| 4+ characters | $3 |

Short names (1–3 chars) are premium inventory that can **not** be reserved via
donations. Reserved-but-unclaimed names stay blocked from public sale for 30 days
after claims open, then can be released.

### Label rules

`a–z`, `0–9`, hyphens (not leading/trailing), 1–32 characters onchain; donor
reservations require 4+. Frontends should ENSIP-15-normalize before submitting.

## Architecture

```
ETHEREUM MAINNET                              ROBINHOOD CHAIN (4663)
┌──────────────────────────┐                  ┌───────────────────────────┐
│ HoodfiDonations          │                  │ L2Registry (Durin)        │
│  donate(years, labels)   │                  │  ERC-721 subnames +       │
│   └─► official ENS       │  owner copies    │  addr/text/contenthash    │
│       controller.renew() │  reservations    ├───────────────────────────┤
│  reservations onchain    │ ───────────────► │ HoodfiRegistrar           │
│  finalize() at 1000y     │  (verifiable)    │  Paused → Claim → Public  │
├──────────────────────────┤                  │  claim() free · register()│
│ HoodfiL1Resolver         │                  │  ETH / USDG               │
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
  GET (`/v1/{sender}/{data}.json`, `.json` optional) and POST, and returns empty
  bytes — never a 500 — for unknown records or unminted names.

## Repository layout

| Path | What |
|---|---|
| `contracts/` | Foundry workspace. Vendored [Durin](https://github.com/namestonehq/durin) (MIT) with the hoodfi contracts in `src/hoodfi/` |
| `contracts/src/hoodfi/HoodfiDonations.sol` | Mainnet donation + reservation tracker |
| `contracts/src/hoodfi/HoodfiRegistrar.sol` | Robinhood Chain phase-aware registrar |
| `contracts/src/hoodfi/HoodfiL1Resolver.sol` | Mainnet apex + wildcard resolver |
| `contracts/src/hoodfi/LabelUtils.sol` | Shared label validation (mirrored in `frontend/lib/labels.ts`) |
| `contracts/scripts/hoodfi/` | Deploy scripts (donations / L2 stack / L1 resolver) |
| `contracts/test/hoodfi/` | 50 unit + fork tests |
| `gateway/` | Cloudflare Worker (Hono + viem): EIP-3668 gateway with trusted-signer responses |
| `frontend/` | Next.js 16 static export → IPFS: donation desk, live millennium ruler, claim/mint pages |
| `scripts/export-reservations.mjs` | Snapshot audit/export: L1 logs → verified `loadReservations()` calldata |

## Contract reference

### `HoodfiDonations` (mainnet)

| Function | Access | Notes |
|---|---|---|
| `donate(uint256 numYears, string[] labels)` payable | anyone (pre-finalize) | Renews hoodfi.eth atomically via the official controller, credits slots, reserves labels; refunds all excess |
| `reserve(string[] labels)` | anyone (pre-finalize) | Spend earned, unspent slots |
| `extend(uint256 numYears)` payable | anyone, forever | Renew without slots (post-goal support) |
| `finalize()` | anyone, once `totalYearsDonated ≥ 1000` | Freezes reservations, records `snapshotBlock` |
| `quote(uint256 numYears)` view | — | Live ETH cost from the ENS oracle |
| `nameExpires()` view | — | hoodfi.eth expiry straight from the .eth registrar |
| `reservationStatus(string)` view | — | 0 available · 1 reserved · 2 blocked · 3 invalid |
| `setBlocklist(bytes32[], bool)` | owner | Infra labels (`www`, `reserve`, `admin`, …) |

Events: `Donated(donor, numYears, ethPaid, newExpiry)`,
`NameReserved(donor, labelhash, label)`, `GoalReached`, `Extended`.
Invariant: **contract balance is zero after every transaction** (no withdraw
function exists).

### `HoodfiRegistrar` (Robinhood Chain)

| Function | Access | Notes |
|---|---|---|
| `claim(string label)` | reserved donor, Claim+Public phases | Free mint of a reserved name |
| `register(string label)` payable | anyone, Public phase | Tier-priced ETH mint, excess refunded |
| `registerWithUsdc(string label)` | anyone, Public phase | Tier-priced USDG (6 decimals), straight to treasury |
| `status(string)` / `priceOf(string)` view | — | 0 available · 1 taken · 2 reserved · 3 invalid; (wei, usdg) prices |
| `loadReservations(bytes32[], address[])` | owner, Paused only | Copy of the L1 snapshot — audit with `scripts/export-reservations.mjs` |
| `setPhase(uint8)` | owner | 0 Paused · 1 Claim · 2 Public |
| `releaseUnclaimed(bytes32[])` | owner, ≥30 days after claims open | Frees never-claimed reservations |
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

## Deploy runbook (already executed for the live system)

1. **L2 stack** — `forge script scripts/hoodfi/DeployL2.s.sol --rpc-url robinhood --broadcast`
   (env: `PRIVATE_KEY`, `TREASURY`, optional `USDC`, optional `PRICE_WEI_*`).
   Registrar starts **Paused**.
2. **Donations** — `forge script scripts/hoodfi/DeployDonations.s.sol --rpc-url mainnet --broadcast --verify`
   (deploys + loads the infra blocklist).
3. **Gateway** — `cd gateway && bunx wrangler deploy`, then
   `wrangler secret put SIGNER_PRIVATE_KEY` (a **dedicated** key — never the
   owner key) and set `L2_REGISTRY_ADDRESS` in `wrangler.toml [vars]`.
   Check `/health`.
4. **L1 resolver** — `forge script scripts/hoodfi/DeployL1Resolver.s.sol --rpc-url mainnet --broadcast --verify`
   (env: `GATEWAY_URL` **templated GET form** `…/v1/{sender}/{data}.json`,
   `GATEWAY_SIGNER`, `L2_REGISTRY`).
5. **Apex cutover, zero-downtime order:** copy the current apex records into the
   new resolver (`setAddr`, `setContenthash` if set), **then**
   `ENS.setResolver(namehash("hoodfi.eth"), resolver)`. Note: from this point the
   apex contenthash is managed on `HoodfiL1Resolver`, not the PublicResolver.
6. **Verify** with `gateway/scripts/verify-live.ts` (`viem.getEnsAddress` for a
   minted subname, the apex, and an unminted name → null).
7. **Frontend** — fill addresses in `.env.local`, `npm run build`, `bash pin.sh`,
   set the contenthash.

## Launch operations

Goal hit → anyone calls `finalize()` → run
`DONATIONS_ADDRESS=0x… DEPLOY_BLOCK=25511636 node scripts/export-reservations.mjs`
(cross-checks every `NameReserved` event against live storage, writes
`reservations-snapshot.json` with batched calldata) → owner sends the
`loadReservations` batches on L2 → `setPhase(Claim)` → same day
`setPhase(Public)` → after 30 days `releaseUnclaimed`. **Anyone can re-run the
export script against public RPCs to audit the snapshot.**

## Trust model, stated honestly

| Component | Guarantee |
|---|---|
| Donations | Trustless. ETH goes to the official ENS controller inside the donor's own tx; the contract cannot hold funds. Progress = `nameExpires()` on the official .eth registrar. |
| Minted names | Seizure-proof ERC-721s. No admin burn/transfer exists; re-minting an existing name reverts. Owners set their own records. |
| Reservations & snapshot | Onchain on L1; the L2 copy is publicly auditable against the logs. |
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

# HoodFi v2 deploy runbook

Mint-first relaunch: 100-year goal, short-name credits, public minting of 4+ char names,
name management, analytics, per-route OG cards.

**Both contracts must be redeployed.** `GOAL_YEARS` was a `constant` and the old registrar
had no way to gate by length or to load credits while live. Nothing is lost: the donation
contract holds no funds by design and has **zero donations and zero reservations**, so
there is no state to migrate.

The **L2Registry stays** (`0xf2bABA012244bdD7445129597350054E1B3aEe5C`). Only the registrar
is swapped, which preserves `test1000.hoodfi.eth`, the NFT baseURI, the CCIP gateway
wiring and mainnet resolution. Rehearsed against live chain state in
`test/hoodfi/HoodfiRegistrar.fork.t.sol` — 7/7 passing.

---

## 0. Pre-flight — all clear as of 2026-08-06

| Check | Value | Status |
|---|---|---|
| `PRIVATE_KEY` in `contracts/.env` | set, derives to `0x5f11a48230f7CdaB91A2361576239091E4b1165b` | ✅ matches the registry owner |
| Mainnet balance | 0.004410 ETH vs 0.000377 needed | ✅ ~11× headroom |
| Robinhood balance | 0.001446 ETH vs 0.000248 needed | ✅ ~5.8× headroom |
| `UpgradeRegistrar` dry run | simulated clean against live chain | ✅ |

Nothing is blocking. Both deploys are affordable from the current balances.

---

## 1. Deploy HoodfiDonations v2 (Ethereum mainnet)

```bash
cd contracts
forge script scripts/hoodfi/DeployDonations.s.sol \
  --rpc-url mainnet --broadcast --verify
```

Record the address and the **deploy block** — the frontend donation feed reads logs from it.

Simulated clean: ~0.00038 ETH.

## 2. Deploy HoodfiRegistrar v2 (Robinhood Chain)

`CREDIT_SIGNER` must be the gateway's signer, `0xCF5441a75eDAab232165D91f683e8E43Add8aAA7`
— that is the key that signs credit vouchers. Get it wrong and short-name mints revert
with `BadVoucher()`.

```bash
CREDIT_SIGNER=0xCF5441a75eDAab232165D91f683e8E43Add8aAA7 \
forge script scripts/hoodfi/UpgradeRegistrar.s.sol \
  --rpc-url robinhood --broadcast
```

This one script deploys the registrar, loads the infra blocklist (24 labels — `www`,
`api`, `hood`, `robinhood`…), wires USDG, then `addRegistrar(new)` **before**
`removeRegistrar(old)` so there is never a window with no authorized registrar.

Public minting of 4+ char names is **live the moment this lands**. Short names stay
locked until you call `openShorts()`.

Verify on Blockscout afterwards.

## 3. Gateway (Cloudflare, dmpay account)

New secrets:

```bash
cd gateway
npx wrangler secret put MAINNET_RPC_URL      # any reliable mainnet RPC
npx wrangler secret put DONATIONS_ADDRESS    # from step 1
npx wrangler secret put REGISTRAR_ADDRESS    # from step 2
npx wrangler deploy
```

Optional, for analytics — add to `wrangler.toml`:

```toml
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "hoodfi_events"
```

Without the binding the `/e` endpoint still 204s, so the site never breaks; events are
just discarded.

Check: `curl https://hoodfi-gateway.dmpay.workers.dev/voucher/0x5f11a48230f7CdaB91A2361576239091E4b1165b`
→ 404 with "No short-name credits" until you donate, then a signed voucher.

## 4. Frontend env

`frontend/.env.local`:

```
NEXT_PUBLIC_DONATIONS_ADDRESS=        # step 1
NEXT_PUBLIC_DONATIONS_DEPLOY_BLOCK=   # step 1
NEXT_PUBLIC_REGISTRAR_ADDRESS=        # step 2
NEXT_PUBLIC_L2_REGISTRY_ADDRESS=0xf2bABA012244bdD7445129597350054E1B3aEe5C
NEXT_PUBLIC_USDC_ADDRESS=0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168
NEXT_PUBLIC_L2_DEPLOY_BLOCK=15164296
NEXT_PUBLIC_VOUCHER_URL=https://hoodfi-gateway.dmpay.workers.dev/voucher
NEXT_PUBLIC_ANALYTICS_URL=https://hoodfi-gateway.dmpay.workers.dev/e
NEXT_PUBLIC_CANONICAL_URL=https://hoodfi.name
```

Plus **per deployment**:

- IPFS build: `NEXT_PUBLIC_SITE_URL=https://hoodfi.eth.limo`
- Vercel build: `NEXT_PUBLIC_SITE_URL=https://hoodfi.name`

`SITE_URL` drives absolute OG image URLs (must be same-origin to be fetchable).
`CANONICAL_URL` is the single address you want indexed, identical on both builds.

## 5. Ship the site

```bash
cd frontend
npm run build                 # 7-10 min on this Mac
PINATA_JWT=… bash pin.sh      # prints the CID
```

Then set the contenthash **on the HoodfiL1Resolver, not the PublicResolver**:

```bash
cast send 0x37215Dd89D0Fd4ea0Dbce690bDe58490fB7f7cF2 \
  "setContenthash(bytes32,bytes)" \
  $(cast namehash hoodfi.eth) 0xe30101701220<cid-digest> \
  --rpc-url mainnet --private-key $PRIVATE_KEY
```

## 6. Optional second deployment (hoodfi.name on Vercel)

- Vercel → import `RWA-ID/hoodfi-eth`, **root directory `frontend`**, framework Next.js.
- Env: everything from step 4 with `NEXT_PUBLIC_SITE_URL=https://hoodfi.name`.
- ⚠️ Connecting Vercel to the repo means **pushes to `main` now deploy**. This repo has
  had no CI, so that is a behaviour change worth knowing about.
- Point an ENS `url` text record on hoodfi.eth at `https://hoodfi.name` so the two are
  linked on-chain.

---

## 7. Post-deploy checklist

- [ ] Mint a 4+ char name end to end, paying in ETH
- [ ] Mint one paying in USDG (approve → register)
- [ ] Donate 1 year on mainnet → confirm `shortCredits` = 1
- [ ] Fetch `/voucher/<your address>` → signed voucher returned
- [ ] Mint a short name with the credit → free, `creditsSpent` = 1
- [ ] Set an avatar + X handle on /manage, confirm they read back
- [ ] `getEnsAddress('test1000.hoodfi.eth')` from mainnet still resolves (CCIP untouched)
- [ ] Paste the URL into X's card validator and confirm the OG image renders
- [ ] Confirm analytics events land

## 8. When the goal is reached

```bash
cast send <donations> "finalize()" --rpc-url mainnet   # public marker, anyone can call
cast send <registrar> "openShorts()" --rpc-url robinhood
```

`openShorts()` is one-way. Credits keep minting short names free afterwards.

## 9. Still open

- Send the Robinhood dev team the live link — they asked to be kept updated and this is
  the announcement worth sending.

# hoodfi.eth contracts

Foundry workspace for HoodFi Names: lifetime `*.hoodfi.eth` ENS names, minted as ERC-721s
on Robinhood Chain (chain id 4663) and resolved from Ethereum mainnet over CCIP-Read.

The HoodFi contracts are in [`src/hoodfi/`](./src/hoodfi/). Everything else under `src/` is
[Durin](https://github.com/namestonehq/durin) by NameStone (MIT), vendored as the base the
registry and L1 resolver are built on. Durin's own deploy guide is kept at
[`DURIN.md`](./DURIN.md). It describes the upstream template, not this deployment.

## Live deployments

| Contract | Chain | Address | Owner |
|---|---|---|---|
| [`HoodfiL1Resolver`](./src/hoodfi/HoodfiL1Resolver.sol) | Ethereum mainnet | [`0x37215Dd89D0Fd4ea0Dbce690bDe58490fB7f7cF2`](https://etherscan.io/address/0x37215Dd89D0Fd4ea0Dbce690bDe58490fB7f7cF2) | HoodFi Safe |
| [`HoodfiDonations`](./src/hoodfi/HoodfiDonations.sol) v2 (closed since ENSv2) | Ethereum mainnet | [`0x588c597bA6a3685511617bCece8457ca7648c9c0`](https://etherscan.io/address/0x588c597bA6a3685511617bCece8457ca7648c9c0) | Not moved; holds no funds |
| [`L2Registry`](./src/L2Registry.sol) (hoodfi.eth) | Robinhood Chain | [`0xf2bABA012244bdD7445129597350054E1B3aEe5C`](https://robinhoodchain.blockscout.com/address/0xf2bABA012244bdD7445129597350054E1B3aEe5C) | HoodFi Safe |
| [`HoodfiRegistrar`](./src/hoodfi/HoodfiRegistrar.sol) v2 | Robinhood Chain | [`0x56be5565acc823f4195c2cf3b9046C083633209a`](https://robinhoodchain.blockscout.com/address/0x56be5565acc823f4195c2cf3b9046C083633209a) | HoodFi Safe |
| [`HoodfiPartnerRouter`](./src/hoodfi/HoodfiPartnerRouter.sol) | Robinhood Chain | [`0xb7bd5f2c7c445ddc5d55ebd9b8f6a20c2e6e4b5d`](https://robinhoodchain.blockscout.com/address/0xb7bd5f2c7c445ddc5d55ebd9b8f6a20c2e6e4b5d) | HoodFi Safe |
| [`HoodfiSites`](./src/hoodfi/HoodfiSites.sol) | Robinhood Chain | [`0x90517237F52caC977398CA1391b3B006bA028c99`](https://robinhoodchain.blockscout.com/address/0x90517237F52caC977398CA1391b3B006bA028c99) | HoodFi Safe |

The HoodFi Safe is a 2-of-3 at
[`0x837Fa2d033f1F7275452D780a5E54Eda903C1330`](https://etherscan.io/address/0x837Fa2d033f1F7275452D780a5E54Eda903C1330),
at the same address on both chains. It also holds hoodfi.eth itself and renews it monthly.
Each owner can be checked live with `cast call <address> "owner()(address)"`.

Minted names can't be seized. No admin burn or transfer function exists, and owners write
their own records on the L2Registry. What the owner keys control, and what they can't
touch, is set out in the root README under
[Trust model, stated honestly](../README.md#trust-model-stated-honestly).

## What each contract does

- **`HoodfiL1Resolver`**: the mainnet resolver for hoodfi.eth. It implements ENSIP-10 `resolve`,
  answers apex queries from onchain storage, and sends every subname query to the gateway with
  EIP-3668 `OffchainLookup`. Gateway answers are checked against `signer()`.
- **`L2Registry`**: Durin's registry. Each name is an ERC-721 whose token id is its namehash,
  and its address, text and contenthash records are stored with it. It has no transfer hook,
  so records do not follow the token on a sale.
- **`HoodfiRegistrar`**: the public mint, paid in ETH (`register`) or USDG
  (`registerWithUsdc`) at tier prices. It sets the ETH (60) and Robinhood Chain (2147488311)
  address records to the minter, and it enforces the blocklist and the short-name rules.
- **`HoodfiPartnerRouter`**: lets a platform resell 4+ character names at its own price. It
  re-points the name's address records at the buyer before transferring the token, and holds
  the partner's margin as a pull payment. It is deliberately **not** an approved registrar.
- **`HoodfiSites`**: takes payment for HoodFi Sites publishing and pays out partner template
  shares. It records payment and cannot write a `contenthash`.
- **`HoodfiDonations`**: the original mainnet donation drive for hoodfi.eth's registration.
  It has been closed since ENSv2 and is still read for `shortCredits`.

## Tests

```bash
forge test --match-path "test/hoodfi/*"                    # unit tests, no network
MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com \
  forge test --match-path "test/hoodfi/*"                  # + fork tests against live ENS
```

That's 128 tests in 7 suites, and CI runs the unit set on every pull request. Dependencies are
vendored under `lib/`, so no submodule checkout is needed.

## Deploy scripts

The HoodFi deploy scripts are in [`scripts/hoodfi/`](./scripts/hoodfi/). Safe batches
(Transaction Builder JSON, nothing signed or sent) are in [`bash/`](./bash/), for example
`SafeRenewHoodfi.sh` and `SafeOpenShorts.sh`. The full runbook is in the root README under
[Deploy runbook](../README.md#deploy-runbook).

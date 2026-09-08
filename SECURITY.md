# Security policy

## Reporting a vulnerability

**Email [hector@rwa-id.com](mailto:hector@rwa-id.com)** with "hoodfi security" in the
subject. Please do not open a public issue for anything that could put names, records
or funds at risk.

Include what you need to make the case — the contract or endpoint, what an attacker
gets, and a transaction, request or script that shows it. A proof of concept against a
fork or a local `anvil` is ideal; `gateway/scripts/e2e-local.ts` stands up the whole
resolution path locally if that helps.

Expect an acknowledgement within 72 hours. There is no bug bounty program; this is a
small project and it will say so rather than imply otherwise.

## In scope

| | |
|---|---|
| `HoodfiDonations` | Ethereum mainnet `0x588c597bA6a3685511617bCece8457ca7648c9c0` |
| `HoodfiL1Resolver` | Ethereum mainnet `0x37215Dd89D0Fd4ea0Dbce690bDe58490fB7f7cF2` |
| `L2Registry` | Robinhood Chain `0xf2bABA012244bdD7445129597350054E1B3aEe5C` |
| `HoodfiRegistrar` | Robinhood Chain `0x56be5565acc823f4195c2cf3b9046C083633209a` |
| `HoodfiSites` | Robinhood Chain `0x90517237F52caC977398CA1391b3B006bA028c99` |
| CCIP-Read gateway | `hoodfi-gateway.dmpay.workers.dev`, and the credit-voucher signer on it |
| MCP server | `hoodfi-mcp.com` |
| Sites and builder | `www.hoodfi.name`, `build.hoodfi.name`, and published `*.hoodfi.eth` sites |

Findings we are particularly interested in, because they are where the design puts its
trust:

- Anything that lets the **CCIP gateway sign an answer it did not get from the chain**.
  A signed empty response verifies perfectly against the resolver, so clients cache a
  cryptographically valid lie and the outage is invisible. `gateway/src/ccip-read/query.ts`
  separates "the chain answered no" from "we could not reach the chain"; only the first
  is ever signed.
- Anything that mints a **short name past what a donation earned** — a voucher replay,
  a digest collision, or an accounting gap between `shortCredits` on L1 and the
  registrar's spent tracking on L2.
- Anything that gets **script or markup into a published site**. Every builder field is
  attacker-controlled and the output is a permanent pin on a `hoodfi.eth` subdomain, so
  an escape past `builder/lib/templates/html.ts` — including a `data:` URL carrying
  HTML, which executes on the visitor's origin — is a wallet-drainer on our subdomain.
- Anything that lets someone **publish on a name they do not own**, or flip a name onto
  the republish price.
- Anything that moves a **minted name** without its owner's signature.

## Out of scope

- The trusted-signer property of the CCIP gateway itself. It is a known, documented
  design position with a stated upgrade path to Arbitrum storage-proof verification —
  see "Trust model, stated honestly" in the README. A *compromise* of the signer is in
  scope; the fact that a signer exists is not.
- Availability of IPFS pinning. Published CIDs are handed to their owners precisely so
  they can be re-pinned anywhere.
- Third-party clients that do not implement ENSIP-10 or EIP-3668. Trust Wallet's
  non-ETH-coin send screen is a known example and is documented in the README.
- Findings that require a compromised user device, browser or wallet.
- Reports from automated scanners with no demonstrated impact.

## Disclosure

Report privately, give us a reasonable window to ship a fix, and we will credit you in
the release notes unless you would rather stay anonymous.

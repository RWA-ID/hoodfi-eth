# hoodfi-mcp

An MCP server that lets AI agents register names under `hoodfi.eth` on Robinhood Chain.

**It holds no private keys and never broadcasts a transaction.** Every tool is a
chain read plus some calldata encoding; the agent signs and submits. Nothing here can
move funds, so the worst an abusive caller can do is spend compute.

## Endpoint

```
https://hoodfi-mcp.dmpay.workers.dev/mcp     Streamable HTTP (stateless)
https://hoodfi-mcp.dmpay.workers.dev/        plain-JSON description of the server
```

Stateless means no session is issued and no Durable Object sits behind it: each POST
is a self-contained JSON-RPC call. `GET /mcp` deliberately 405s rather than holding
open a stream that would never carry a message.

## Tools

| Tool | Does |
| --- | --- |
| `hoodfi_check_name` | Availability, price in ETH and USDG, and the reason when a name can't be had |
| `hoodfi_build_registration_tx` | Unsigned calldata to register — one step for ETH, up to two for USDG |
| `hoodfi_resolve_name` | Owner, address records, text records and website for a minted name |
| `hoodfi_build_set_contenthash_tx` | Unsigned calldata to point a name at an IPFS or IPNS site, or to clear it |
| `hoodfi_build_set_address_tx` | Unsigned calldata to set the name's Ethereum, Bitcoin and Solana addresses |

### A name can be a website

`hoodfi_build_set_contenthash_tx` writes an EIP-1577 record, which makes the name serve
that content at `<label>.hoodfi.eth.link` — no DNS, no host, no certificate. It takes a
CID in any shape people copy them in (bare, `ipfs://`, `ipns://`, a gateway URL) and
refuses anything it could not link to: Swarm and Arweave namespaces, and a CID with a
trailing path, which the record cannot carry.

Two properties worth knowing before wiring it in:

- **It reads `ownerOf` before returning calldata.** `setContenthash` is owner-only, and
  the ERC-721 and the address records are separate things — a name can resolve to a
  wallet that does not own it. So a wrong signer gets a sentence rather than a revert.
- **The codec is not this package's.** It is one shared copy at
  `frontend/shared/contenthash.ts`, imported by relative path and covered by
  `node --experimental-strip-types frontend/shared/contenthash.test.mjs`. Two
  implementations of a byte format is how a name ends up holding a well-formed record
  that resolves to nothing; the header comment there explains why it lives under
  `frontend/`.

### A name can hold addresses for other chains

`hoodfi_build_set_address_tx` writes ENSIP-9 `addr` records for Ethereum, Bitcoin and
Solana, so paying the name resolves to the right address on each. Any combination in one
call; when more than one record moves they are batched through the resolver's
`multicall`, so the owner signs once. Like the contenthash tool it reads `ownerOf` first
and refuses a no-op, and it encodes before it reads so a bad address costs no RPC budget.

Two properties that are not obvious:

- **An EVM address is two records, not one.** It is written under both mainnet ETH
  (coinType 60) and the Robinhood Chain coinType, because they answer different
  questions — 60 is what mainnet ENS clients read, the chain-specific record is what
  resolution on Robinhood Chain keys on. `HoodfiRegistrar._register` sets both at mint
  and `/manage` keeps them in step. Writing only 60 leaves a name resolving on mainnet
  while going quietly dead on its own chain, so the tool takes no `coinType` argument
  and always writes the pair.

- **"It encoded cleanly" means different things per chain**, and the tool says which in
  a `verify` field. Bitcoin is checksummed, so a typo is caught. Ethereum is checked
  only when the caller supplied EIP-55 capitalisation. **Solana has no checksum at
  all** — any 32 bytes of base58 is a well-formed address, so a one-character typo
  becomes a different, equally valid key that nothing can detect. These are payment
  records, so that caveat is returned to be relayed, not swallowed. All three claims
  are pinned by vectors in `src/coins.test.mjs` (`npm test`).

The codecs come from `@ensdomains/address-encoder`, a direct dependency of this package
rather than a copy in `frontend/shared/`. That is not a departure from the one-copy rule:
shared files there must be dependency-free (see the header of `shared/contenthash.ts`),
base58check and bech32m are not worth hand-rolling twice, and the site imports the same
package — so the byte format still has exactly one definition. `src/coins.ts` explains
the split.

### Three things the tool descriptions tell agents, because they will otherwise assume otherwise

**The name lands with whoever signs.** `HoodfiRegistrar._register` mints to
`msg.sender` — there is no recipient argument, so an agent cannot register a name on
behalf of a third address. It registers for *itself*.

**Only 4+ character names are registerable.** Names of 1–3 characters are premium
inventory reserved for donors spending short-name credits, and stay locked until the
100-year donation goal is reached and the owner calls `openShorts()`. `check_name`
reports them as `locked` with the reason; `build_registration_tx` refuses them before
spending any RPC budget. When shorts open they become ordinary priced mints and both
tools cover them with no code change.

**An address record is a payment instruction, and not every chain can check one.** See
above: only Bitcoin catches a typo outright. The tool descriptions and the server
`instructions` both say so, because an agent that gets calldata back without complaint
will otherwise report the address as validated.

## Contracts

Robinhood Chain, id **4663** (Arbitrum Orbit, ETH gas).

| | |
| --- | --- |
| HoodfiRegistrar | `0x56be5565acc823f4195c2cf3b9046C083633209a` |
| L2Registry | `0xf2bABA012244bdD7445129597350054E1B3aEe5C` |
| USDG | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |

Names are lifetime ERC-721s — no expiry, no renewals.

## Develop

```sh
npm install
npm run dev          # wrangler dev on :8787
npm run typecheck
```

```sh
curl -s -X POST localhost:8787/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"hoodfi_check_name","arguments":{"name":"example"}}}'
```

## Deploy

```sh
npm run deploy
wrangler secret put ROBINHOOD_RPC_URL   # dedicated endpoint — see below
```

### Why this worker is separate from `gateway/`

`hoodfi-gateway`'s URL is baked into HoodfiL1Resolver on mainnet: it answers *every*
CCIP-Read lookup for the domain. A publicly-listed agent endpoint sharing that worker
could degrade name resolution for everyone under load. Different blast radius,
different worker.

### Every tool batches through Multicall3

Multicall3 is deployed on Robinhood Chain at the canonical
`0xcA11bde05977b3631167028862bE2a173976CA11`, and the chain definition points viem at
it. Resolving a name reads nine records. Sent as nine separate round-trips from a
Worker, the public RPC throttled them within a handful of requests; sent as one
multicall, it doesn't.

The batching also carries a correctness property, which is the more important half.
An earlier version wrapped `ownerOf` in a `try/catch` and treated a failure as "never
minted" — so a throttled call reported a *registered* name as unregistered, with no
error anywhere. Same failure mode as a CCIP gateway that answers "no records" when its
backend is down: the outage vanishes and a confident lie takes its place.

Multicall makes the two cases structurally different. A transport failure fails the
whole batch and throws. A genuine "token does not exist" comes back as a per-call
`status: 'failure'` inside a batch that otherwise succeeded. Only the second is allowed
to mean "not registered" — so **never reintroduce a `try/catch` around an individual
read here**.

### Why it should still get its own RPC secret

Public RPCs throttle Cloudflare Workers hard — every colo egresses from a small shared
pool, so the rate limiter sees one very busy caller. The gateway measured 2/12 calls
succeeding from the worker against 15/15 from a laptop. Put a dedicated endpoint in the
`ROBINHOOD_RPC_URL` secret; the public endpoints stay behind it in a `fallback`
transport so a missing secret degrades instead of failing outright.

`ROBINHOOD_RPC_URL` must **not** also be declared in `wrangler.toml [vars]` — a plain
var of the same name blocks `secret put` and reverts the secret on every deploy.

Errors are never echoed raw to callers: a viem error embeds the full transport URL,
which for this worker is the dedicated RPC with its API key in the path. Anything that
isn't a deliberate `ToolError` comes back as a generic message.

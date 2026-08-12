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
| `hoodfi_resolve_name` | Owner, address records and text records for a minted name |

### Two things the tool descriptions tell agents, because they will otherwise assume otherwise

**The name lands with whoever signs.** `HoodfiRegistrar._register` mints to
`msg.sender` — there is no recipient argument, so an agent cannot register a name on
behalf of a third address. It registers for *itself*.

**Only 4+ character names are registerable.** Names of 1–3 characters are premium
inventory reserved for donors spending short-name credits, and stay locked until the
100-year donation goal is reached and the owner calls `openShorts()`. `check_name`
reports them as `locked` with the reason; `build_registration_tx` refuses them before
spending any RPC budget. When shorts open they become ordinary priced mints and both
tools cover them with no code change.

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

import { createPublicClient, http, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'

import { robinhoodChain } from '../src/chains'

const REGISTRY_ABI = parseAbi([
  'function baseNode() view returns (bytes32)',
  'function makeNode(bytes32 parentNode, string label) pure returns (bytes32)',
  'function addr(bytes32 node) view returns (address)',
])

const client = createPublicClient({ chain: mainnet, transport: http('https://ethereum-rpc.publicnode.com') })

const sub = await client.getEnsAddress({ name: normalize('test1000.hoodfi.eth') })
console.log('test1000.hoodfi.eth →', sub)
const apex = await client.getEnsAddress({ name: normalize('hoodfi.eth') })
console.log('hoodfi.eth →', apex)
const unminted = await client.getEnsAddress({ name: normalize('nobody-here-xyz.hoodfi.eth') })
console.log('nobody-here-xyz.hoodfi.eth →', unminted, '(expected null/zero)')

const OWNER = '0x5f11a48230f7CdaB91A2361576239091E4b1165b'

// The subname is checked against the L2 registry, not against a constant. This used to
// assert test1000 resolved to OWNER, which went stale the moment that name was
// transferred — the script then failed on every run while resolution was perfectly
// healthy, which is the worst kind of check: one that cries wolf until nobody reads it.
// Comparing mainnet to the chain the record actually lives on is the real invariant, and
// it is also the only version of this test that can catch a gateway signing a lie.
// The worker's own chain definition, not a hand-written one — a second copy of the RPC
// URL here is a copy that goes stale silently the next time the endpoint moves.
const l2 = createPublicClient({ chain: robinhoodChain, transport: http() })
const registry = '0xf2bABA012244bdD7445129597350054E1B3aEe5C' as const
const baseNode = await l2.readContract({
  address: registry, abi: REGISTRY_ABI, functionName: 'baseNode',
})
const node = await l2.readContract({
  address: registry, abi: REGISTRY_ABI, functionName: 'makeNode', args: [baseNode, 'test1000'],
})
const onL2 = await l2.readContract({
  address: registry, abi: REGISTRY_ABI, functionName: 'addr', args: [node],
})
console.log('test1000 addr record on Robinhood Chain →', onL2)

const subOk = sub?.toLowerCase() === onL2.toLowerCase()
const apexOk = apex?.toLowerCase() === OWNER.toLowerCase()
if (subOk && apexOk && unminted === null) {
  console.log('✓ LIVE: *.hoodfi.eth resolves via the Universal Resolver on Ethereum mainnet')
  console.log('✓ the subname matches its L2 record — the gateway is answering truthfully')
} else {
  if (!subOk) console.error(`✗ subname mismatch: mainnet ${sub} vs L2 ${onL2}`)
  if (!apexOk) console.error(`✗ apex mismatch: ${apex} (expected ${OWNER})`)
  if (unminted !== null) console.error(`✗ unminted name returned ${unminted}, expected null`)
  process.exit(1)
}

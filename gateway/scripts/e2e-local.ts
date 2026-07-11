/**
 * Local end-to-end: L1 anvil (HoodfiL1Resolver) → OffchainLookup → local gateway →
 * L2 anvil (L2Registry, chainId 4663) → signed response → resolveWithProof.
 * viem follows EIP-3668 automatically on readContract.
 */
import { createPublicClient, http, namehash, parseAbi, toHex, encodeFunctionData, decodeAbiParameters } from 'viem'
import { foundry } from 'viem/chains'

const RESOLVER = process.env.RESOLVER ?? '0x5FbDB2315678afecb367f032d93F642f64180aa3'

const client = createPublicClient({ chain: foundry, transport: http('http://localhost:8545') })

function dnsEncode(name: string): `0x${string}` {
  const parts = name.split('.')
  const bytes: number[] = []
  for (const part of parts) {
    bytes.push(part.length)
    for (const ch of new TextEncoder().encode(part)) bytes.push(ch)
  }
  bytes.push(0)
  return toHex(new Uint8Array(bytes))
}

const abi = parseAbi([
  'function resolve(bytes name, bytes data) view returns (bytes)',
  'function addr(bytes32 node) view returns (address)',
  'function text(bytes32 node, string key) view returns (string)',
])

const node = namehash('blake.hoodfi.eth')
const inner = encodeFunctionData({ abi, functionName: 'addr', args: [node] })

const result = await client.readContract({
  address: RESOLVER as `0x${string}`,
  abi,
  functionName: 'resolve',
  args: [dnsEncode('blake.hoodfi.eth'), inner],
})

const [resolved] = decodeAbiParameters([{ type: 'address' }], result as `0x${string}`)
console.log('blake.hoodfi.eth →', resolved)

const expected = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
if (resolved.toLowerCase() === expected.toLowerCase()) {
  console.log('✓ FULL PIPELINE VERIFIED: resolver → gateway → L2 registry → signed proof')
} else {
  console.error(`✗ expected ${expected}`)
  process.exit(1)
}

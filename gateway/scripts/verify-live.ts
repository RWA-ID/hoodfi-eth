import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'

const client = createPublicClient({ chain: mainnet, transport: http('https://ethereum-rpc.publicnode.com') })

const sub = await client.getEnsAddress({ name: normalize('test1000.hoodfi.eth') })
console.log('test1000.hoodfi.eth →', sub)
const apex = await client.getEnsAddress({ name: normalize('hoodfi.eth') })
console.log('hoodfi.eth →', apex)
const unminted = await client.getEnsAddress({ name: normalize('nobody-here-xyz.hoodfi.eth') })
console.log('nobody-here-xyz.hoodfi.eth →', unminted, '(expected null/zero)')

const OWNER = '0x5f11a48230f7CdaB91A2361576239091E4b1165b'
if (sub?.toLowerCase() === OWNER.toLowerCase() && apex?.toLowerCase() === OWNER.toLowerCase()) {
  console.log('✓ LIVE: *.hoodfi.eth resolves via the Universal Resolver on Ethereum mainnet')
} else {
  console.error('✗ resolution mismatch'); process.exit(1)
}

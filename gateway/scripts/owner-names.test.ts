/**
 * Live check for GET /owner/:address/names against Robinhood Chain.
 *   bun scripts/owner-names.test.ts
 * Calls the worker's fetch directly, no server needed.
 */
import worker from '../src/index'

const env = { L2_REGISTRY_ADDRESS: '0xf2bABA012244bdD7445129597350054E1B3aEe5C' } as never
const ask = async (addr: string) => {
  const t = Date.now()
  const res = await worker.fetch(new Request(`https://gw.test/owner/${addr}/names`), env, {} as never)
  return { status: res.status, ms: Date.now() - t, body: await res.json() as any }
}

const cases = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      '0x5557d68555B1D851B8088fC49b0420F408a70Ef5',
      '0x645cf432e829f9def6eb8e3974d3aee4580cbcdd',
      '0x5f11a48230f7CdaB91A2361576239091E4b1165b',
      '0x000000000000000000000000000000000000dEaD',
      'nope',
    ]
for (const a of cases) {
  const { status, ms, body } = await ask(a)
  console.log(`== ${a} [${status}, ${ms}ms] primary=${body.primary ?? null}`)
  for (const n of body.names ?? []) console.log(`   ${n.resolves ? '✓' : '·'} ${n.name}  addr=${n.addr}  avatar=${n.avatar ? 'yes' : 'no'}`)
  if (!body.names) console.log('  ', body)
}

// Live checks against Robinhood Chain and the HoodFi gateway. Not part of `npm test`
// (the public RPC throttles CI); run with `npm run test:live`.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createHoodfiClient } from '../dist/index.js'

const hoodfi = createHoodfiClient()
const SAFE = '0x837Fa2d033f1F7275452D780a5E54Eda903C1330'

test('gm.hoodfi.eth resolves with an owner and a Robinhood address', async () => {
  const p = await hoodfi.resolve('gm')
  assert.ok(p, 'gm is minted')
  assert.match(p.owner, /^0x[0-9a-fA-F]{40}$/)
  console.log(p)
})

test('a random long name is available at the $3 floor', async () => {
  const label = `sdk-test-${Date.now().toString(36)}`
  const c = await hoodfi.checkName(label)
  assert.equal(c.available, true)
  assert.equal(c.price.usdg, 3_000_000n)
  assert.ok(c.price.wei > 0n)
  const reg = await hoodfi.buildRegistration({ name: label, account: SAFE })
  assert.equal(reg.steps.length, 1)
})

test('reverse lookup answers for the Safe', async () => {
  const r = await hoodfi.lookupAddress(SAFE)
  assert.equal(r.address, SAFE)
  assert.ok(Array.isArray(r.names))
  console.log(r.primary, r.names.length)
})

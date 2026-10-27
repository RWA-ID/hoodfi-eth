/**
 * checkHoodfiName: the parser behind hoodfi_prepare_send and hoodfi_resolve_name.
 *
 * Run with `npm test` from `mcp/` (Node 22.18+ strips the types from labels.ts).
 *
 * What is pinned: a name outside hoodfi.eth is refused, never rewritten. "vitalik.eth"
 * used to become vitalik.hoodfi.eth, a different name anyone can mint, and
 * "jesse.base.eth" became jesse.base.hoodfi.eth, which whoever holds base.hoodfi.eth can
 * create for free. A payment tool that does that pays a stranger.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { checkHoodfiName, checkLabel } from './labels.ts'

const labelsOf = (input) => {
  const check = checkHoodfiName(input)
  assert.ok(check.ok, `${input} should pass: ${check.reason}`)
  return check.labels
}

const refusal = (input) => {
  const check = checkHoodfiName(input)
  assert.ok(!check.ok, `${input} should be refused, got ${JSON.stringify(check)}`)
  return check.reason
}

test('accepts a bare name and any name ending in .hoodfi.eth', () => {
  assert.deepEqual(labelsOf('gmgm'), ['gmgm'])
  assert.deepEqual(labelsOf('gm.hoodfi.eth'), ['gm'])
  assert.deepEqual(labelsOf('  GM.HoodFi.ETH '), ['gm'])
  assert.deepEqual(labelsOf('jack.gm.hoodfi.eth'), ['jack', 'gm'])
})

test('refuses another .eth name instead of paying its hoodfi.eth lookalike', () => {
  assert.match(refusal('vitalik.eth'), /vitalik\.eth is not a hoodfi\.eth name/)
  assert.match(refusal('vitalik.eth'), /vitalik\.hoodfi\.eth would be a different name/)
  assert.match(refusal('jesse.base.eth'), /jesse\.base\.eth is not a hoodfi\.eth name/)
  assert.match(refusal('hoodfi.eth'), /parent name itself/)
})

test('refuses a dotted name without the .hoodfi.eth suffix', () => {
  // Could be a name in another system (jack.cb.id, alice.box); ask for the full name.
  assert.match(refusal('jack.gm'), /full name ending in \.hoodfi\.eth/)
  assert.match(refusal('alice.box'), /not a hoodfi\.eth name/)
})

test('strips the suffix once, so a trailing .eth label is not lost', () => {
  assert.deepEqual(labelsOf('foo.eth.hoodfi.eth'), ['foo', 'eth'])
})

test('every label still passes the mint check', () => {
  assert.match(refusal('bad_name.hoodfi.eth'), /"bad_name"/)
  assert.match(refusal('-gm'), /hyphen/)
  assert.match(refusal(''), /empty/)
  assert.match(refusal('a..hoodfi.eth'), /empty/)
})

test('checkLabel keeps its rewrite for check_name and registration', () => {
  assert.deepEqual(checkLabel('vitalik.eth'), { ok: true, label: 'vitalik' })
})

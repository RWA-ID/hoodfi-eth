/**
 * The publish path parser, which decides what name a publish is about.
 *
 * Run: `bun scripts/site-path.test.ts`
 *
 * Worth a test of its own because every failure here is silent — an over-strict rule
 * rejects a name that exists, and a too-loose one accepts a string that namehashes to
 * something nobody owns. Neither shows up as a wrong-looking page.
 */
import assert from 'node:assert/strict'

import { MAX_DEPTH, normalizeSitePath } from '../src/site-path'

// A plain name.
assert.equal(normalizeSitePath('agent'), 'agent')
assert.equal(normalizeSitePath('test1000'), 'test1000')
assert.equal(normalizeSitePath('a-b-c'), 'a-b-c')

// A subname, at any depth. This is the case the first version rejected, and rejecting it
// is what stranded a payment on crypto.gm.hoodfi.eth.
assert.equal(normalizeSitePath('crypto.gm'), 'crypto.gm')
assert.equal(normalizeSitePath('a.b.gm'), 'a.b.gm')
assert.equal(normalizeSitePath(Array(MAX_DEPTH).fill('a').join('.')), Array(MAX_DEPTH).fill('a').join('.'))

// Callers have sent both forms of the suffix.
assert.equal(normalizeSitePath('crypto.gm.hoodfi.eth'), 'crypto.gm')
assert.equal(normalizeSitePath('agent.hoodfi.eth'), 'agent')
assert.equal(normalizeSitePath('  AGENT.HoodFi.ETH '), 'agent')

// Rejected: anything that is not a path of labels.
for (const bad of [
  '',
  '   ',
  '.',
  '..',
  '.gm', // empty leading label
  'gm.', // empty trailing label
  'crypto..gm',
  'crypto/gm',
  'crypto gm',
  'crypto_gm',
  '../../etc/passwd',
  'a'.repeat(64), // one label past 63
  Array(MAX_DEPTH + 1).fill('a').join('.'),
  'a'.repeat(256),
]) {
  assert.equal(normalizeSitePath(bad), '', `should reject ${JSON.stringify(bad)}`)
}

// The argument is a path BELOW hoodfi.eth, so a label that happens to read like a TLD is
// just a label: `crypto.gm.eth` means `crypto.gm.eth.hoodfi.eth`, which is a name someone
// may legitimately hold. Guessing intent here would reject a real name; ownership is what
// actually gates the publish, and `ownerOf` 404s anything nobody holds.
assert.equal(normalizeSitePath('crypto.gm.eth'), 'crypto.gm.eth')
assert.equal(normalizeSitePath('myhoodfi.eth'), 'myhoodfi.eth')

// Only the exact suffix is stripped, and only from the end.
assert.equal(normalizeSitePath('nothoodfi.gm'), 'nothoodfi.gm')
assert.equal(normalizeSitePath('hoodfi.eth.gm'), 'hoodfi.eth.gm')

console.log('site-path: all assertions passed')

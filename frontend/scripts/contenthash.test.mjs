/**
 * Regression test for the contenthash codec: `npm test`.
 *
 * Worth having for this one file because a wrong answer here is invisible. Every other
 * record fails loudly — a bad address won't parse, a bad avatar won't load — but a
 * contenthash off by one byte is a perfectly well-formed record that simply resolves
 * to nothing, on a name the owner then can't tell is broken.
 *
 * The vectors are cross-checked against `multiformats`, which is not a dependency of
 * the app; they're pinned here so the codec can be verified without one.
 */
import assert from "node:assert";
import {
  contentGatewayUrl,
  decodeContenthash,
  encodeContenthash,
  parseContenthash,
} from "../lib/contenthash.ts";

// The canonical vector from @ensdomains/content-hash's README.
const QM = "QmRAQB6YaCyidP37UdDnjFY5vQuiBrcqdyoW1CuDgwxkD4";
const QM_HEX =
  "0xe3010170122029f2d17be6139079dc48696d1f582a8530eb9805b561eda517e22a892c7e3f1f";

assert.equal(encodeContenthash(QM), QM_HEX, "bare CIDv0");
assert.equal(encodeContenthash(`ipfs://${QM}`), QM_HEX, "ipfs:// CIDv0");
assert.equal(encodeContenthash(`https://ipfs.io/ipfs/${QM}`), QM_HEX, "path gateway");
assert.equal(encodeContenthash(`  ipfs://${QM}  `), QM_HEX, "whitespace");

const decoded = decodeContenthash(QM_HEX);
assert.ok(decoded, "a stored IPFS record decodes");
assert.equal(decoded.protocol, "ipfs");
assert.equal(
  decoded.id,
  "bafybeibj6lixxzqtsb45ysdjnupvqkufgdvzqbnvmhw2kf7cfkesy7r7d4",
  "CIDv0 is shown as its CIDv1 base32 equivalent"
);
assert.equal(decoded.uri, `ipfs://${decoded.id}`);
assert.equal(
  contentGatewayUrl(decoded),
  "https://bafybeibj6lixxzqtsb45ysdjnupvqkufgdvzqbnvmhw2kf7cfkesy7r7d4.ipfs.dweb.link/"
);

// Round trip: what we show has to re-encode to the same bytes, or an owner opening the
// editor and pressing save would rewrite their record into something else.
assert.equal(encodeContenthash(decoded.uri), QM_HEX, "base32 round trip");
assert.equal(encodeContenthash(decoded.id), QM_HEX, "bare base32 round trip");
assert.equal(
  encodeContenthash(contentGatewayUrl(decoded)),
  QM_HEX,
  "subdomain gateway round trip"
);

// A CIDv1 in the raw codec — a single file rather than a directory.
const RAW = "bafkreibj6lixxzqtsb45ysdjnupvqkufgdvzqbnvmhw2kf7cfkesy7r7d4";
const rawHex = encodeContenthash(RAW);
assert.ok(rawHex?.startsWith("0xe30101"), "raw codec is still ipfs-ns");
assert.equal(decodeContenthash(rawHex)?.id, RAW, "raw CIDv1 round trip");

// IPNS: a libp2p key, base36.
const IPNS = "k51qzi5uqu5dlvj2baxnqndepeb86cbk3ng7n3i46uzyxzyqj2xjonzllnv0v8";
const ipnsHex = encodeContenthash(`ipns://${IPNS}`);
assert.ok(ipnsHex?.startsWith("0xe5010172"), "ipns-ns with libp2p-key codec");
const ipnsDecoded = decodeContenthash(ipnsHex);
assert.ok(ipnsDecoded, "a stored IPNS record decodes");
assert.equal(ipnsDecoded.protocol, "ipns");
assert.equal(ipnsDecoded.id, IPNS, "base36 round trip");
assert.equal(
  contentGatewayUrl(ipnsDecoded),
  `https://${IPNS}.ipns.dweb.link/`
);
assert.equal(encodeContenthash(IPNS), ipnsHex, "a bare k51 key needs no prefix");
// The CID's codec outranks the prefix that was typed.
assert.equal(encodeContenthash(`ipfs://${IPNS}`), ipnsHex, "mislabelled key");

// An old-style peer id only becomes a key when it says so.
const PEER = "12D3KooWRBy97UB99e3J6hiPesre1MZeuNQvfan4gBziswrRJsNK";
assert.equal(encodeContenthash(PEER), ipnsHex, "the same key, written the old way");

// Rejections — each of these must not become a stored record.
for (const bad of [
  "",
  "   ",
  "hello",
  "https://example.com/",
  "https://example.com/blog",
  QM.slice(0, 30), // truncated
  `${QM}x`,
  `ipfs://${QM}/index.html`, // a path the record cannot carry
  "ipfs://",
  "bafybeib", // decodes, but is not a CID
  "0xdeadbeef",
]) {
  assert.equal(encodeContenthash(bad), null, `should reject: ${JSON.stringify(bad)}`);
}

// Unset and unsupported records read as "no site" rather than a broken link.
assert.equal(decodeContenthash("0x"), null);
assert.equal(decodeContenthash(undefined), null);
assert.equal(decodeContenthash("0xe40101fa011b20d1de9994b4d039f6548d191eb26786769f580809256b4685ef316805265ea162"), null, "swarm");
assert.equal(decodeContenthash("0xe3010170"), null, "ipfs-ns with no CID");

// The editor's preview agrees with what gets written.
assert.equal(parseContenthash(`ipfs://${QM}`)?.id, decoded?.id);
assert.equal(parseContenthash("nope"), null);

console.log("contenthash: all assertions passed");

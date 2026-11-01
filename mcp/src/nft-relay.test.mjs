import assert from 'node:assert/strict'
import { test } from 'node:test'
import { encodeFunctionData, parseAbi } from 'viem'

import { SEAPORT, describeNftTx, isOwnNftTransfer, isSeaportEthFill, nftAbi, seaportAbi } from './nft-relay.ts'

const me = '0x5557d68555B1D851B8088fC49b0420F408a70Ef5'
const other = '0x2D037f66b9e0EDE90c2080558a7d3FF7BE36E9A1'

const send721 = (from) =>
  encodeFunctionData({ abi: nftAbi, functionName: 'safeTransferFrom', args: [from, other, 733n] })
const send1155 = (from) =>
  encodeFunctionData({ abi: nftAbi, functionName: 'safeTransferFrom', args: [from, other, 7n, 2n, '0x'] })

test('the sender moving their own ERC-721 or ERC-1155 token passes, in any address case', () => {
  assert.equal(isOwnNftTransfer(send721(me), 0n, me), true)
  assert.equal(isOwnNftTransfer(send1155(me), 0n, me), true)
  assert.equal(isOwnNftTransfer(send721(me), 0n, me.toLowerCase()), true)
})

test("someone else's token is refused", () => {
  assert.equal(isOwnNftTransfer(send721(other), 0n, me), false)
  assert.equal(isOwnNftTransfer(send1155(other), 0n, me), false)
})

test('a transfer carrying ETH is refused', () => {
  assert.equal(isOwnNftTransfer(send721(me), 1n, me), false)
})

test('approvals, ERC-20 lookalikes and junk are refused', () => {
  const other_abi = parseAbi([
    'function setApprovalForAll(address,bool)',
    'function approve(address,uint256)',
    'function transferFrom(address,address,uint256)',
  ])
  for (const [functionName, args] of [
    ['setApprovalForAll', [other, true]],
    ['approve', [other, 1n]],
    ['transferFrom', [me, other, 1n]],
  ])
    assert.equal(isOwnNftTransfer(encodeFunctionData({ abi: other_abi, functionName, args }), 0n, me), false, functionName)
  assert.equal(isOwnNftTransfer('0x', 0n, me), false)
  assert.equal(isOwnNftTransfer('0xdeadbeef', 0n, me), false)
})

const SELLER = '0xfe49c9173a9bce789e0a29c5132a22e96be8ac95'
const fill = (basicOrderType = 0) =>
  encodeFunctionData({
    abi: seaportAbi,
    functionName: 'fulfillBasicOrder_efficient_6GL6yc',
    args: [{
      considerationToken: '0x0000000000000000000000000000000000000000', considerationIdentifier: 0n, considerationAmount: 1n,
      offerer: SELLER, zone: '0x0000000000000000000000000000000000000000', offerToken: other, offerIdentifier: 1n, offerAmount: 1n,
      basicOrderType, startTime: 0n, endTime: 1n, zoneHash: `0x${'0'.repeat(64)}`, salt: 1n,
      offererConduitKey: `0x${'0'.repeat(64)}`, fulfillerConduitKey: `0x${'0'.repeat(64)}`,
      totalOriginalAdditionalRecipients: 0n, additionalRecipients: [], signature: '0x',
    }],
  })

test('a Seaport ETH fill passes, with the marketplace suffix too', () => {
  assert.equal(isSeaportEthFill(SEAPORT, fill()), true)
  assert.equal(isSeaportEthFill(SEAPORT.toLowerCase(), `${fill()}cdb44011`), true)
})

test('the same call to another contract, an ERC-20-paid order, and other Seaport calls are refused', () => {
  assert.equal(isSeaportEthFill(other, fill()), false)
  assert.equal(isSeaportEthFill(SEAPORT, fill(8)), false)
  assert.equal(isSeaportEthFill(SEAPORT, '0xfd9f1e10'), false)
})

test('the result card reads the token, recipient and quantity from the calldata', () => {
  const sent = describeNftTx(other, send1155(me))
  assert.equal(sent.kind, 'send')
  assert.equal(sent.contract, other)
  assert.equal(sent.tokenId, 7n)
  assert.equal(sent.quantity, 2n)
  const bought = describeNftTx(SEAPORT, `${fill()}cdb44011`)
  assert.equal(bought.kind, 'buy')
  assert.equal(bought.tokenId, 1n)
  assert.equal(describeNftTx(other, '0xdeadbeef'), null)
})

#!/bin/bash
# Builds the monthly hoodfi.eth renewal as a Safe Transaction Builder batch.
#
# Since ENSv2 (2026-10-27) the v1 ETHRegistrarController reverts, so HoodfiDonations can
# no longer renew. hoodfi.eth is an unmigrated v1 name (v2 registry status 1, RESERVED),
# which renews through ENS's ETHRenewerV1, paid in USDC. Anyone may renew any name; the
# HoodFi Safe does it once a month until the expiry reaches 2127.
#
# The batch is two calls, executed atomically by the Safe through MultiSend:
#   1. USDC.approve(ETHRenewerV1, quote)   — the EXACT quote, never unlimited
#   2. ETHRenewerV1.renew(("hoodfi", YEARS * 365d, 0x0), USDC)
#
# The quote carries dust (six years is 27000071, not 27000000). A rounded approval
# reverts "ERC20: transfer amount exceeds allowance" — which is why this reads the
# quote rather than taking a dollar figure.
#
# Six years is the default because that is where ENS's multi-year discount bottoms out
# for a 5+ character name ($4.50/yr), and six years costs less than five.
#
# Fork-proven 2026-10-29 from the Safe: expiry 2042-07-06 -> 2048-07-04, ~186k gas,
# registry owner unchanged.
#
# Usage: bash/SafeRenewHoodfi.sh [years] [out.json]
#   then Safe{Wallet} -> Apps -> Transaction Builder -> drag the JSON in -> review -> sign.
set -euo pipefail

YEARS="${1:-6}"
OUT="${2:-safe-renew-hoodfi-$(date -u +%Y-%m-%d).json}"
RPC="${MAINNET_RPC_URL:-https://ethereum-rpc.publicnode.com}"

SAFE=0x837Fa2d033f1F7275452D780a5E54Eda903C1330
RENEWER=0x56c447F308F463A01121C41E72b0E7e7557fCb68
USDC=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
BASE_REGISTRAR=0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85
ETH_REGISTRY_V2=0xf60aba43E1f7F3DAB1186Ff03B561401C9Df85E2
LABEL=hoodfi
ZERO32=0x0000000000000000000000000000000000000000000000000000000000000000

LABELHASH=$(cast keccak "$LABEL")
TOKEN_ID=$(cast to-dec "$LABELHASH")
DURATION=$((YEARS * 31536000))

# A v1 name that has migrated to v2 renews on the v2 registrar instead, and the renewer
# refuses it. Stop rather than build a batch that reverts.
STATUS=$(cast call "$ETH_REGISTRY_V2" 'getStatus(uint256)(uint8)' "$LABELHASH" --rpc-url "$RPC")
if [ "$STATUS" != "1" ]; then
    echo "Error: hoodfi.eth v2 status is $STATUS, not 1 (unmigrated v1). It renews elsewhere now."
    exit 1
fi

QUOTE=$(cast call "$RENEWER" 'getRenewPrice(string,uint64,address)(uint256)' \
    "$LABEL" "$DURATION" "$USDC" --rpc-url "$RPC" | cut -d' ' -f1)
BALANCE=$(cast call "$USDC" 'balanceOf(address)(uint256)' "$SAFE" --rpc-url "$RPC" | cut -d' ' -f1)
EXPIRY=$(cast call "$BASE_REGISTRAR" 'nameExpires(uint256)(uint256)' "$TOKEN_ID" --rpc-url "$RPC" | cut -d' ' -f1)
ETH_BALANCE=$(cast balance "$SAFE" --ether --rpc-url "$RPC")

APPROVE_DATA=$(cast calldata 'approve(address,uint256)' "$RENEWER" "$QUOTE")
RENEW_DATA=$(cast calldata 'renew((string,uint64,bytes32),address)' \
    "(\"$LABEL\",$DURATION,$ZERO32)" "$USDC")

cat > "$OUT" <<JSON
{
  "version": "1.0",
  "chainId": "1",
  "createdAt": $(($(date +%s) * 1000)),
  "meta": {
    "name": "Renew hoodfi.eth +${YEARS}y",
    "description": "Approve exactly ${QUOTE} USDC (6dp) to ETHRenewerV1, then renew hoodfi.eth for ${YEARS} years.",
    "txBuilderVersion": "1.18.0",
    "createdFromSafeAddress": "${SAFE}"
  },
  "transactions": [
    { "to": "${USDC}", "value": "0", "data": "${APPROVE_DATA}", "contractMethod": null, "contractInputsValues": null },
    { "to": "${RENEWER}", "value": "0", "data": "${RENEW_DATA}", "contractMethod": null, "contractInputsValues": null }
  ]
}
JSON

fmt_date() { date -u -r "$1" +%Y-%m-%d 2>/dev/null || date -u -d "@$1" +%Y-%m-%d; }

echo "hoodfi.eth expires      $(fmt_date "$EXPIRY")"
echo "after +${YEARS}y            $(fmt_date $((EXPIRY + DURATION)))"
echo "quote                   ${QUOTE} (\$$(echo "scale=2; $QUOTE / 1000000" | bc) USDC)"
echo "Safe USDC               ${BALANCE} (\$$(echo "scale=2; $BALANCE / 1000000" | bc))"
echo "Safe ETH (gas)          ${ETH_BALANCE}"
echo "wrote                   ${OUT}"

if [ "$BALANCE" -lt "$QUOTE" ]; then
    echo "WARNING: the Safe holds less USDC than the quote — fund it before executing, or the batch reverts."
fi

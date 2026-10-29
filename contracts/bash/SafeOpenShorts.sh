#!/bin/bash
# Builds the one-way "open short names" call as a Safe Transaction Builder batch for
# Robinhood Chain (4663), where the HoodFi Safe owns HoodfiRegistrar.
#
# openShorts() is irreversible: there is no closeShorts. After it, every unblocked 1-3
# character label mints publicly at the registrar's stored tier prices (read and
# printed below — check them before signing). Credits keep minting shorts free.
#
# Optional: pass labels to blocklist in the same batch, BEFORE openShorts, so they are
# never sellable for even a block. setBlocklist is reversible (setBlocklist(..., false)).
#
# Usage: bash/SafeOpenShorts.sh [label ...]
#   e.g. bash/SafeOpenShorts.sh mcp rpc ens eth
set -euo pipefail

RPC="${ROBINHOOD_RPC_URL:-https://rpc.mainnet.chain.robinhood.com}"
OUT="safe-open-shorts-$(date -u +%Y-%m-%d).json"

SAFE=0x837Fa2d033f1F7275452D780a5E54Eda903C1330
REGISTRAR=0x56be5565acc823f4195c2cf3b9046C083633209a

OWNER=$(cast call "$REGISTRAR" 'owner()(address)' --rpc-url "$RPC")
if [ "$(echo "$OWNER" | tr 'A-F' 'a-f')" != "$(echo "$SAFE" | tr 'A-F' 'a-f')" ]; then
    echo "Error: registrar owner is $OWNER, not the HoodFi Safe."
    exit 1
fi
if [ "$(cast call "$REGISTRAR" 'shortsOpen()(bool)' --rpc-url "$RPC")" = "true" ]; then
    echo "Short names are already open. Nothing to do."
    exit 0
fi

TXS=""
if [ "$#" -gt 0 ]; then
    HASHES=""
    for label in "$@"; do
        HASHES="${HASHES:+$HASHES,}$(cast keccak "$label")"
    done
    BLOCK_DATA=$(cast calldata 'setBlocklist(bytes32[],bool)' "[$HASHES]" true)
    TXS="{ \"to\": \"${REGISTRAR}\", \"value\": \"0\", \"data\": \"${BLOCK_DATA}\", \"contractMethod\": null, \"contractInputsValues\": null },"
    echo "blocklisting first:     $*"
fi
OPEN_DATA=$(cast calldata 'openShorts()')
TXS="${TXS}{ \"to\": \"${REGISTRAR}\", \"value\": \"0\", \"data\": \"${OPEN_DATA}\", \"contractMethod\": null, \"contractInputsValues\": null }"

cat > "$OUT" <<JSON
{
  "version": "1.0",
  "chainId": "4663",
  "createdAt": $(($(date +%s) * 1000)),
  "meta": {
    "name": "Open hoodfi short names",
    "description": "HoodfiRegistrar.openShorts() — one-way.",
    "txBuilderVersion": "1.18.0",
    "createdFromSafeAddress": "${SAFE}"
  },
  "transactions": [ ${TXS} ]
}
JSON

for t in 0 1 2; do
    WEI=$(cast call "$REGISTRAR" 'priceWei(uint256)(uint256)' "$t" --rpc-url "$RPC" | cut -d' ' -f1)
    USD=$(cast call "$REGISTRAR" 'priceUsdc(uint256)(uint256)' "$t" --rpc-url "$RPC" | cut -d' ' -f1)
    echo "$((t + 1))-char price           \$$(echo "scale=2; $USD / 1000000" | bc) USDG | $(cast from-wei "$WEI") ETH"
done
echo "wrote                   ${OUT}"

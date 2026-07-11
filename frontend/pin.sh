#!/usr/bin/env bash
# Pin the static export to Pinata and print the CID for the yournames.eth
# contenthash. Usage: PINATA_JWT=… bash pin.sh   (or set PINATA_JWT in .env.local)
set -euo pipefail

cd "$(dirname "$0")"

if [ -z "${PINATA_JWT:-}" ] && [ -f .env.local ]; then
  PINATA_JWT=$(grep -E '^PINATA_JWT=' .env.local | cut -d= -f2- || true)
fi
if [ -z "${PINATA_JWT:-}" ]; then
  echo "PINATA_JWT is not set (env or .env.local)" >&2
  exit 1
fi

if [ ! -d out ]; then
  echo "No out/ directory — run 'npm run build' first" >&2
  exit 1
fi

echo "Uploading out/ to Pinata…"
ARGS=()
while IFS= read -r -d '' f; do
  ARGS+=(-F "file=@${f};filename=out${f#./out}")
done < <(find ./out -type f -print0)

RESPONSE=$(curl -s -X POST "https://api.pinata.cloud/pinning/pinFileToIPFS" \
  -H "Authorization: Bearer ${PINATA_JWT}" \
  -F 'pinataMetadata={"name":"hoodfi-eth"}' \
  "${ARGS[@]}")

CID=$(echo "$RESPONSE" | python3 -c 'import sys,json;print(json.load(sys.stdin)["IpfsHash"])')
echo
echo "Pinned ✓  CID: ${CID}"
echo "Set the reserve.hoodfi.eth contenthash to: ipfs://${CID}"
echo "Preview: https://${CID}.ipfs.dweb.link/"

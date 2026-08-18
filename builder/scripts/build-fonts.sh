#!/usr/bin/env bash
# Regenerates lib/templates/fonts.ts.
#
# Not part of the build: the output is committed, deterministic, and changes only when a
# template needs a new face. Running this on every build would mean a Vercel container
# needing Python, fonttools and network access to three font repos in order to produce a
# file that was already correct.
#
# Requires: python3 with fonttools + brotli (a venv is fine), and the source fonts.
set -euo pipefail

WORK="${WORK:-$(mktemp -d)}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/lib/templates/fonts.ts"

# Latin-1 Supplement and Latin Extended-A on top of ASCII: the accents in names people
# actually type. Costs about 4.5KB per face over plain ASCII, which is nothing against
# any uploaded image and is the difference between "José" rendering and not.
UNICODES="U+0020-007E,U+00A0,U+00B7,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2022,U+2026,U+2192,U+00C0-00FF,U+0100-017F,U+20AC,U+2122"

echo "work dir: $WORK"
cd "$WORK"

curl -sSL -o archivo.ttf \
  "https://raw.githubusercontent.com/Omnibus-Type/Archivo/master/fonts/variable/Archivo%5Bwdth%2Cwght%5D.ttf"
curl -sSL -o manrope.ttf \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/Manrope%5Bwght%5D.ttf"
curl -sSL -o departure.zip \
  "https://github.com/rektdeckard/departure-mono/releases/latest/download/DepartureMono-1.500.zip"
unzip -oq departure.zip -d departure

inst () { # out, src, axis...
  local out=$1 src=$2; shift 2
  python3 -m fontTools.varLib.instancer -o "_$out.ttf" "$src" "$@" >/dev/null
  pyftsubset "_$out.ttf" --unicodes="$UNICODES" --layout-features="kern,liga" \
    --flavor=woff2 --output-file="$out.woff2"
}

# Archivo carries a wdth axis, which is why the Manifesto template needs no fifth family:
# its wide display type is this same face at the top of that axis.
inst archivo-400      archivo.ttf wght=400 wdth=100
inst archivo-800      archivo.ttf wght=800 wdth=100
inst archivo-800-wide archivo.ttf wght=800 wdth=125
inst manrope-400      manrope.ttf wght=400
inst manrope-700      manrope.ttf wght=700
pyftsubset departure/DepartureMono-*/DepartureMono-Regular.otf --unicodes="$UNICODES" \
  --layout-features="kern,liga" --flavor=woff2 --output-file=departure-mono-latin.woff2

echo "subsetted:"
ls -l ./*.woff2 | awk '{printf "  %-28s %6d B\n", $9, $5}'
echo
echo "Now regenerate $OUT from these files."

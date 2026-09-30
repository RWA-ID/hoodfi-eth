#!/usr/bin/env bash
# Regenerates lib/templates/links-fonts.ts — the faces the Links template offers.
#
# A separate file from fonts.ts, and a separate script from build-fonts.sh, on purpose.
# Running build-fonts.sh rewrites every face the other four templates ship, and upstream
# font repos move: a Links change should not be able to silently re-cut Terminal's pixel
# face. Same subsetting rules, same Unicode range, its own output.
#
# Links lets the owner pick one of six faces, so a published page embeds only the one it
# uses (plus Plex Mono for the handle and labels). The editor embeds all of them, which is
# what lets the font picker draw each "Aa" in its real face with no network request.
#
# Variable instances where a face is used at more than one weight: one file carrying
# 400-700 is smaller than three static cuts, and the page asks for 400, 600 and 700.
#
# Requires: python3 with fonttools + brotli (a venv is fine), curl.
set -euo pipefail

WORK="${WORK:-$(mktemp -d)}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/lib/templates/links-fonts.ts"

PYBIN="${PYBIN:-python3}"
SUBSET="${SUBSET:-pyftsubset}"

# Kept identical to build-fonts.sh. U+2197 (↗) is added because every link button prints
# one, and a fallback-font arrow beside an embedded label is the mismatch build-fonts.sh
# warns about for ■.
UNICODES="U+0020-007E,U+00A0,U+00B7,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2022,U+2026,U+2192,U+2197,U+00C0-00FF,U+0100-017F,U+20AC,U+2122,U+221E"

echo "work dir: $WORK"
cd "$WORK"

GF="https://raw.githubusercontent.com/google/fonts/main/ofl"
curl -sSfL -o archivo.ttf \
  "https://raw.githubusercontent.com/Omnibus-Type/Archivo/master/fonts/variable/Archivo%5Bwdth%2Cwght%5D.ttf"
curl -sSfL -o grotesk.ttf "$GF/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf"
curl -sSfL -o dmsans.ttf "$GF/dmsans/DMSans%5Bopsz,wght%5D.ttf"
curl -sSfL -o instrument.ttf "$GF/instrumentserif/InstrumentSerif-Regular.ttf"
curl -sSfL -o jetbrains.ttf "$GF/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf"
curl -sSfL -o syne.ttf "$GF/syne/Syne%5Bwght%5D.ttf"
curl -sSfL -o plexmono.ttf "$GF/ibmplexmono/IBMPlexMono-Regular.ttf"

sub () { # out, src
  "$SUBSET" "$2" --unicodes="$UNICODES" --layout-features="kern,liga" \
    --flavor=woff2 --output-file="$1.woff2"
}

inst () { # out, src, axis...
  local out=$1 src=$2
  shift 2
  "$PYBIN" -m fontTools.varLib.instancer -o "_$out.ttf" "$src" "$@" >/dev/null
  sub "$out" "_$out.ttf"
}

inst archivo archivo.ttf wdth=100 wght=400:800
inst grotesk grotesk.ttf wght=400:700
# opsz pinned at 14: DM Sans is only ever body text here, and the optical-size axis
# roughly doubles the file for sizes this page never sets.
inst dmsans dmsans.ttf opsz=14 wght=400:700
inst jetbrains jetbrains.ttf wght=400:700
# Syne is display-only (its pairing sets body in DM Sans), and only ever at 800.
inst syne syne.ttf wght=800
sub instrument instrument.ttf
sub plexmono plexmono.ttf

{
  cat <<'EOF'
/**
 * The Links template's faces, embedded.
 *
 * Same rules as fonts.ts — subsetted to Latin-1 + Latin Extended-A, base64 woff2, so a
 * published page fetches nothing — kept in their own file because Links offers a choice
 * of six and a page embeds only the one it was built with.
 *
 * GENERATED. Rebuild with scripts/build-links-fonts.sh rather than editing by hand.
 */
EOF
  emit () { # const, file, comment
    local bytes
    bytes=$(wc -c < "$2.woff2" | tr -d ' ')
    printf '\n/** %s (%s bytes woff2) */\nexport const %s =\n  "%s";\n' \
      "$3" "$bytes" "$1" "$(base64 < "$2.woff2" | tr -d '\n')"
  }
  emit LINKS_ARCHIVO archivo "Archivo, variable wght 400-800 at wdth 100"
  emit LINKS_GROTESK grotesk "Space Grotesk, variable wght 400-700"
  emit LINKS_DMSANS dmsans "DM Sans, variable wght 400-700, opsz 14"
  emit LINKS_INSTRUMENT instrument "Instrument Serif 400"
  emit LINKS_JETBRAINS jetbrains "JetBrains Mono, variable wght 400-700"
  emit LINKS_SYNE syne "Syne 800"
  emit LINKS_PLEX_MONO plexmono "IBM Plex Mono 400 — handle, labels, chips"
} > "$OUT"

echo "wrote $OUT"
ls -l "$WORK"/*.woff2

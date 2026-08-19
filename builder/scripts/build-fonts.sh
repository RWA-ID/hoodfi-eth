#!/usr/bin/env bash
# Regenerates lib/templates/fonts.ts.
#
# Not part of the build: the output is committed, deterministic, and changes only when a
# template needs a new face. Running this on every build would mean a Vercel container
# needing Python, fonttools and network access to four font repos in order to produce a
# file that was already correct.
#
# It now WRITES fonts.ts rather than printing a pile of woff2 files and telling you to
# assemble them. The hand step was the only way for the committed constants to drift from
# the flags that produced them, and a face that is subtly not what the comment claims is
# invisible until someone looks at a published page with fresh eyes.
#
# Requires: python3 with fonttools + brotli (a venv is fine), curl, unzip.
set -euo pipefail

WORK="${WORK:-$(mktemp -d)}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/lib/templates/fonts.ts"

# Which python: honour a venv via PYBIN, else whatever python3 is on PATH.
PYBIN="${PYBIN:-python3}"
SUBSET="${SUBSET:-pyftsubset}"

# Latin-1 Supplement and Latin Extended-A on top of ASCII: the accents in names people
# actually type. Costs about 4.5KB per face over plain ASCII, which is nothing against
# any uploaded image and is the difference between "José" rendering and not.
#
# U+221E (∞) is in the set because the Terminal template prints it as a literal value.
UNICODES="U+0020-007E,U+00A0,U+00B7,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2022,U+2026,U+2192,U+00C0-00FF,U+0100-017F,U+20AC,U+2122,U+221E"

echo "work dir: $WORK"
cd "$WORK"

curl -sSL -o archivo.ttf \
  "https://raw.githubusercontent.com/Omnibus-Type/Archivo/master/fonts/variable/Archivo%5Bwdth%2Cwght%5D.ttf"
curl -sSL -o manrope.ttf \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/Manrope%5Bwght%5D.ttf"
curl -sSL -o bricolage.ttf \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/BricolageGrotesque%5Bopsz,wdth,wght%5D.ttf"
curl -sSL -o silkscreen-regular.ttf \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/silkscreen/Silkscreen-Regular.ttf"
curl -sSL -o silkscreen-bold.ttf \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/silkscreen/Silkscreen-Bold.ttf"
curl -sSL -o departure.zip \
  "https://github.com/rektdeckard/departure-mono/releases/latest/download/DepartureMono-1.500.zip"
unzip -oq departure.zip -d departure

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

# Archivo carries a wdth axis, which is why the Manifesto template needs no extra family:
# its wide display type is this same face at the top of that axis.
inst archivo-800-wide archivo.ttf wght=800 wdth=125

# Product asks for 800 on both headings and 700 on eyebrows and pills, so it needs three.
inst manrope-400 manrope.ttf wght=400
inst manrope-700 manrope.ttf wght=700
inst manrope-800 manrope.ttf wght=800

# Bricolage ships VARIABLE, which is the cheaper option here rather than the fancier one.
# Editorial wants 400/500/600 and it wants the headline at opsz 96 against text at ~14 —
# four static instances of a face with this many contours come to 74KB, and one variable
# file carrying both axes is 59KB. wdth is pinned because nothing asks for it.
"$PYBIN" -m fontTools.varLib.instancer -o _bricolage.ttf bricolage.ttf \
  wdth=100 wght=400:600 >/dev/null
sub bricolage-var _bricolage.ttf

# Silkscreen is a true bitmap-grid face and is NOT instanced or interpolated — the
# regular and bold are separately drawn. Its Latin Extended-A coverage is 7 glyphs out of
# 128, so a Polish or Czech name will render those few characters in the fallback
# monospace beside pixel type. That is ugly and it is still the right trade: the
# alternative is no pixel face at all, and the Terminal template is the pixel face.
sub silkscreen-400 silkscreen-regular.ttf
sub silkscreen-700 silkscreen-bold.ttf

sub departure-mono departure/DepartureMono-*/DepartureMono-Regular.otf

emit () { # const, file, comment
  local bytes
  bytes=$(wc -c < "$2.woff2" | tr -d ' ')
  {
    printf '\n/** %s (%s bytes woff2) */\n' "$3" "$bytes"
    printf 'export const %s =\n  "' "$1"
    base64 < "$2.woff2" | tr -d '\n'
    printf '";\n'
  } >> "$OUT"
}

cat > "$OUT" <<'HEADER'
/**
 * Fonts, embedded.
 *
 * A published site is meant to outlive us, so it cannot depend on fonts.googleapis.com
 * being reachable — a page that silently reflows into a system face years later is not
 * the thing someone paid for. Each face is subsetted to Latin-1 plus Latin Extended-A
 * (French, Spanish, Portuguese, German, Polish, Czech, Turkish, the Nordics) and inlined
 * as base64, which is what lets a template be one self-contained file.
 *
 * Coverage stops at Latin. A bio in Chinese, Arabic or Cyrillic falls through to the
 * system stack every template declares behind its embedded face — the failure mode is
 * "a different font", never tofu in somebody's own name. Embedding CJK would be
 * megabytes.
 *
 * GENERATED. Rebuild with scripts/build-fonts.sh rather than editing by hand.
 */
HEADER

emit SILKSCREEN_400   silkscreen-400    "Silkscreen 400 — the whole Terminal template"
emit SILKSCREEN_700   silkscreen-700    "Silkscreen 700 — Terminal's values and chips"
emit BRICOLAGE_VAR    bricolage-var     "Bricolage Grotesque, variable: wght 400-600, opsz 12-96 — Editorial"
emit ARCHIVO_800_WIDE archivo-800-wide  "Archivo 800 at wdth=125 — the Manifesto headline"
emit MANROPE_400      manrope-400       "Manrope 400 — Product body text"
emit MANROPE_700      manrope-700       "Manrope 700 — Product eyebrows and pills"
emit MANROPE_800      manrope-800       "Manrope 800 — Product headings"
emit DEPARTURE_MONO   departure-mono    "Departure Mono — Manifesto's meta and tagline"

echo "subsetted:"
ls -l ./*.woff2 | awk '{printf "  %-28s %6d B\n", $9, $5}'
echo
echo "wrote $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"

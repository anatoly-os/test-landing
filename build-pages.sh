#!/usr/bin/env bash
#
# Build the static bundle for Cloudflare Pages into dist/.
# Run from the repo root:   bash build-pages.sh
#
# What it does:
#   - copies every deployable static part of the site (no dnevnik — retired);
#   - appends ?v=<content-hash> to style.css / script.js refs in all HTML
#     so browsers refetch assets when they actually change;
#   - the Pages Function for payment leads lives in functions/ at the repo
#     root and is picked up by wrangler automatically (not part of dist/).
#
# Deploy after building:   npx wrangler pages deploy
#
set -euo pipefail

DIST=dist

# Portable 10-char content hash: md5sum on Linux (Cloudflare build image),
# md5 -q on macOS. Both are MD5, so the first 10 hex chars match on both.
hash10() {
  if command -v md5sum >/dev/null 2>&1; then
    md5sum "$1" | cut -c1-10
  else
    md5 -q "$1" | cut -c1-10
  fi
}

CSS_HASH=$(hash10 style.css)
JS_HASH=$(hash10 script.js)
echo "style.css  -> ?v=${CSS_HASH}"
echo "script.js  -> ?v=${JS_HASH}"

rm -rf "${DIST}"
mkdir -p "${DIST}"

# Root-level files
cp style.css script.js photo.png _redirects "${DIST}/"

# /magic book gallery. Source covers are print-size PNGs in magic/books/
# (gitignored, ~1.5 MB each); the repo keeps webp made from them: a small
# .thumb.webp for the grid and a large .webp for the click-to-zoom view.
# A PNG whose webp is missing or older gets converted here.
for src in magic/books/*.png; do
  [ -f "$src" ] || continue
  base="${src%.png}"
  if [ "$src" -nt "$base.webp" ] || [ "$src" -nt "$base.thumb.webp" ]; then
    command -v cwebp >/dev/null 2>&1 || { echo "cwebp not found: brew install webp" >&2; exit 1; }
    cwebp -quiet -q 80 -resize 560 0 "$src" -o "$base.thumb.webp"
    cwebp -quiet -q 82 -resize 1400 0 "$src" -o "$base.webp"
    echo "converted ${src}"
  fi
done

# Directories (self-contained)
cp -R portfolio manifest profiling family_retreats mastering-ai actuallydoit magic "${DIST}/"
find "${DIST}/magic/books" -type f ! -name '*.webp' -delete

# books.json: the gallery list; title goes into alt text. Books of one arcana
# stay together ("15_Аркан_…", "Обложка_15_Аркан") in arcana order, then the
# rest by file name, wands ("Жезл_…") last. "14-17_арканов" is not one arcana.
python3 - magic/books > "${DIST}/magic/books.json" <<'PY'
import json, os, re, sys
d = sys.argv[1]

def order(f):
    if re.match(r'жезл', f, flags=re.I):
        return (2000, f)
    m = re.search(r'(?<![\d-])(\d+)_аркана?(?=_|\.)', f, flags=re.I)
    return (int(m.group(1)) if m else 1000, f)

books = []
for f in sorted(os.listdir(d), key=order):
    if not f.endswith('.webp') or f.endswith('.thumb.webp'):
        continue
    stem = f[:-len('.webp')]
    title = re.sub(r'\s*обложка\s*', ' ', stem.replace('_', ' '), flags=re.I).strip()
    books.append({'thumb': stem + '.thumb.webp', 'full': f, 'title': title})
print(json.dumps(books, ensure_ascii=False))
PY
echo "magic/books -> $(python3 -c 'import json,sys; print(len(json.load(open(sys.argv[1]))))' "${DIST}/magic/books.json") covers, $(du -sh "${DIST}/magic/books" | cut -f1)"

# HTML that needs cache-busted asset refs is staged via bust();
# already-copied HTML inside dirs is rewritten in place below.
bust() {
  sed -e "s|style\.css\"|style.css?v=${CSS_HASH}\"|g" \
      -e "s|script\.js\"|script.js?v=${JS_HASH}\"|g" "$1"
}

for f in index.html 404.html cv.html private1.html private2.html private1-letter.html private2-letter.html; do
  bust "$f" > "${DIST}/$f"
done

for f in "${DIST}"/mastering-ai/*.html; do
  bust "$f" > "$f.tmp" && mv "$f.tmp" "$f"
done

echo
echo "Built ${DIST}/:"
du -sh "${DIST}"
find "${DIST}" -maxdepth 1 | sort | sed 's/^/  /'
echo
echo "Clean URLs (/cv, /private1, ...) and the custom 404 are handled by"
echo "Cloudflare Pages automatically (foo.html is served at /foo; 404.html is the 404 page)."

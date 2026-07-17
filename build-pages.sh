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

CSS_HASH=$(md5 -q style.css | cut -c1-10)
JS_HASH=$(md5 -q script.js | cut -c1-10)
echo "style.css  -> ?v=${CSS_HASH}"
echo "script.js  -> ?v=${JS_HASH}"

rm -rf "${DIST}"
mkdir -p "${DIST}"

# Root-level files
cp style.css script.js photo.png "${DIST}/"

# Directories (self-contained)
cp -R portfolio manifest profiling family_retreats mastering-ai "${DIST}/"

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

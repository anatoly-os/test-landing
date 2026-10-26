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
CV_HASH=$(hash10 cv.css)
# cv-photo.jpg is also the og:image of the landing and CV pages: a new ?v=
# whenever the photo changes makes Telegram & co. refetch it instead of
# showing a cached preview.
PHOTO_HASH=$(hash10 cv-photo.jpg)
echo "style.css  -> ?v=${CSS_HASH}"
echo "script.js  -> ?v=${JS_HASH}"
echo "cv.css     -> ?v=${CV_HASH}"
echo "cv-photo   -> ?v=${PHOTO_HASH}"

rm -rf "${DIST}"
mkdir -p "${DIST}"

# Root-level files
# CV PDFs: regenerate from the HTML when Chrome is around, else ship the committed ones.
if bash build-cv-pdf.sh 2>/dev/null; then :; else echo "CV PDFs: using committed files (Chrome not found)"; fi
cp style.css script.js cv.css cv-photo.jpg cv.pdf cv-cto.pdf sber-cv.pdf photo.png _redirects "${DIST}/"

# Directories (self-contained). /magic moved to magic.osokin.ai (its own
# repo, osokin-magic) — the old URLs redirect there via _redirects.
cp -R portfolio manifest profiling family_retreats mastering-ai actuallydoit "${DIST}/"

# HTML that needs cache-busted asset refs is staged via bust();
# already-copied HTML inside dirs is rewritten in place below.
bust() {
  sed -e "s|style\.css\"|style.css?v=${CSS_HASH}\"|g" \
      -e "s|script\.js\"|script.js?v=${JS_HASH}\"|g" \
      -e "s|cv\.css\"|cv.css?v=${CV_HASH}\"|g" \
      -e "s|cv-photo\.jpg\"|cv-photo.jpg?v=${PHOTO_HASH}\"|g" "$1"
}

for f in index.html 404.html cv.html cv-cto.html sber-cv.html private1.html private2.html private1-letter.html private2-letter.html; do
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
echo "Clean URLs (/cv, /cv-cto, /sber-cv, /private1, ...) and the custom 404 are handled by"
echo "Cloudflare Pages automatically (foo.html is served at /foo; 404.html is the 404 page)."

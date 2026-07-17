#!/usr/bin/env bash
# Deploy the main landing (osokin.ai/) + portfolio assets + /mastering-ai
# course page to the osokin.ai VDS.
# Run from the repo root on macOS.  You run prod yourself — review before executing.
#
# Cache busting: HTML is staged with ?v=<content-hash> appended to style.css /
# script.js references, so browsers pick up new assets on every deploy where
# they actually changed. Repo files stay clean — the rewrite happens only in
# the staging copy.
set -euo pipefail

HOST="root@77.105.169.236"
WEBROOT="/var/www/osokin.ai"

CSS_HASH=$(md5 -q style.css | cut -c1-10)
JS_HASH=$(md5 -q script.js | cut -c1-10)
echo "style.css  -> ?v=${CSS_HASH}"
echo "script.js  -> ?v=${JS_HASH}"

STAGE=$(mktemp -d)
trap 'rm -rf "${STAGE}"' EXIT

# Stage the course dir wholesale (carries pay-qr.png + legal pages), then
# rewrite every HTML in place with the versioned asset refs.
cp -R ./mastering-ai "${STAGE}/mastering-ai"

# Appends ?v=<hash> to style.css / script.js refs. Matches both "style.css"
# and "../style.css" href/src values, and leaves already-versioned refs alone.
bust() {
  sed -e "s|style\.css\"|style.css?v=${CSS_HASH}\"|g" \
      -e "s|script\.js\"|script.js?v=${JS_HASH}\"|g" "$1"
}

bust ./index.html > "${STAGE}/index.html"
for f in "${STAGE}"/mastering-ai/*.html; do
  bust "${f}" > "${f}.tmp" && mv "${f}.tmp" "${f}"
done

# macOS rsync is openrsync: no --chmod. Files are already 644 locally.
rsync -rlptv \
  "${STAGE}/index.html" \
  ./style.css \
  ./script.js \
  ./photo.png \
  ./404.html \
  "${HOST}:${WEBROOT}/"

rsync -rlptv \
  ./portfolio/ \
  "${HOST}:${WEBROOT}/portfolio/"

rsync -rlptv \
  "${STAGE}/mastering-ai/" \
  "${HOST}:${WEBROOT}/mastering-ai/"

echo
echo "Done."
echo "  https://osokin.ai/              — landing (assets versioned ?v=${CSS_HASH})"
echo "  https://osokin.ai/mastering-ai/ — course page"

#!/usr/bin/env bash
# Deploy the main landing (osokin.ai/) + portfolio assets + /mastering-ai
# course page to the osokin.ai VDS.
# Run from the repo root on macOS.  You run prod yourself — review before executing.
set -euo pipefail

HOST="root@77.105.169.236"
WEBROOT="/var/www/osokin.ai"

# macOS rsync is openrsync: no --chmod. Files are already 644 locally.
rsync -rlptv \
  ./index.html \
  ./style.css \
  ./script.js \
  ./photo.png \
  ./404.html \
  "${HOST}:${WEBROOT}/"

rsync -rlptv \
  ./portfolio/ \
  "${HOST}:${WEBROOT}/portfolio/"

rsync -rlptv \
  ./mastering-ai/ \
  "${HOST}:${WEBROOT}/mastering-ai/"

echo
echo "Done."
echo "  https://osokin.ai/              — landing"
echo "  https://osokin.ai/mastering-ai/ — course page (directory with index.html,"
echo "                                    nginx serves it as-is, no config changes)"

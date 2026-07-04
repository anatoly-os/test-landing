#!/usr/bin/env bash
# Deploy the /family_retreats standalone page to the osokin.ai VDS.
# Run from the repo root on macOS.  You run prod yourself — review before executing.
set -euo pipefail

HOST="root@77.105.169.236"
WEBROOT="/var/www/osokin.ai"

# macOS rsync is openrsync: no --chmod. Files are already 644 locally.
rsync -rlptv \
  ./family_retreats/ \
  "${HOST}:${WEBROOT}/family_retreats/"

echo
echo "Done. The page is a directory with index.html, so nginx serves it as-is:"
echo "  https://osokin.ai/family_retreats  (301 -> /family_retreats/)"
echo "No nginx config changes needed."

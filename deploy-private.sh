#!/usr/bin/env bash
# Deploy the /private1 and /private2 date pages to the osokin.ai VDS.
# Run from the repo root on macOS.  You run prod yourself — review before executing.
set -euo pipefail

HOST="root@77.105.169.236"
WEBROOT="/var/www/osokin.ai"

# macOS rsync is openrsync: no --chmod. Files are already 644 locally.
rsync -rlptv \
  ./private1.html \
  ./private2.html \
  ./private1-letter.html \
  ./private2-letter.html \
  ./404.html \
  "${HOST}:${WEBROOT}/"

echo
echo "Files uploaded. Clean URLs /private1 and /private2 need an nginx rule (one-time)."
echo "On the server, in /etc/nginx/sites-enabled/osokin.ai, extend the clean-URL regex:"
echo
echo "    location ~ ^/(cv|private1|private2)\$ {"
echo "        try_files /\$1.html =404;"
echo "    }"
echo
echo "Then: nginx -t && systemctl reload nginx"

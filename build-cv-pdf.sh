#!/usr/bin/env bash
# Render cv.html / cv-cto.html to the PDFs that the «PDF» links serve
# (cv.pdf, cv-cto.pdf — committed; build-pages.sh copies them into dist/).
# Needs Google Chrome; fonts are fetched from Google Fonts, so it needs network.
#   bash build-cv-pdf.sh
set -euo pipefail
cd "$(dirname "$0")"

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
if [ ! -x "$CHROME" ]; then
  echo "Chrome not found at $CHROME (set CHROME=/path/to/chrome)"; exit 1
fi

for page in cv cv-cto; do
  "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
    --virtual-time-budget=8000 \
    --print-to-pdf="$PWD/$page.pdf" "file://$PWD/$page.html" 2>/dev/null
  pages=$(python3 -c "d=open('$page.pdf','rb').read(); print(d.count(b'/Type /Page')-d.count(b'/Type /Pages'))")
  echo "$page.pdf: $pages page(s), $(du -h "$page.pdf" | cut -f1)"
done

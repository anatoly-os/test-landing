#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
cp ../relationships.html dist/index.html
cp assets/og-v1.png dist/og-v1.png

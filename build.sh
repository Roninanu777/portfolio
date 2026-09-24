#!/usr/bin/env bash
# Assemble the deployable site into dist/ with only what the site needs.
# Excluded on purpose: explorations/, blender/, README.md, assets/og.html (source of og.png).
set -euo pipefail
cd "$(dirname "$0")"

rm -rf dist
mkdir -p dist/assets
cp index.html _headers dist/
cp -R css js dist/
cp assets/favicon.svg assets/og.png assets/*.pdf dist/assets/
cp -R assets/interceptor dist/assets/

echo "dist/ ready: $(find dist -type f | wc -l | tr -d ' ') files"

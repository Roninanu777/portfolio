#!/usr/bin/env bash
# Rebuild the resume PDFs from resume.html, then check them.
#   ../assets/Roni-Pradhan-Senior-Software-Engineer.pdf   public (linked from the site)
#   out/Roni-Pradhan-Senior-Software-Engineer.pdf         private, with phone (see build.mjs)
# Needs Node 18+. Installs Playwright + Chromium into ./node_modules on first run.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules/playwright ]; then
  npm install --no-save --no-package-lock --silent playwright@1.50.1
fi
npx --no-install playwright install chromium >/dev/null 2>&1 || true

node build.mjs
node check.mjs

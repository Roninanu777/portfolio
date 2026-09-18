#!/usr/bin/env bash
# Build dist/ and deploy it to Cloudflare (Pages, now part of Workers) as static assets.
# First time on a machine: npx wrangler login
set -euo pipefail
cd "$(dirname "$0")"

./build.sh
npx -y wrangler@latest deploy

#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 24 is required: https://nodejs.org"
  exit 1
fi
if [ ! -f node_modules/ws/package.json ]; then
  npm ci --omit=dev --ignore-scripts --no-audit --no-fund
fi
exec node server/index.cjs

#!/usr/bin/env bash
# The afkconvoy gate: exits 0 only on a good tree.
set -euo pipefail
cd "$(dirname "$0")"
npm ci --no-audit --no-fund
npm run typecheck
npm test
swift build --package-path mac
swift test --package-path mac

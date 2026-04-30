#!/usr/bin/env bash
# Deploy with version + commit baked into wrangler --var so every Worker
# request can read e.APP_VERSION / e.GIT_COMMIT (used by /health and the
# log context — see src/lib/log.ts setLogContext).
#
# Usage: pnpm run deploy   (package.json points here)

set -euo pipefail

# Prefer the most descriptive available identifier:
#   - `git describe` gives "v1.2.3-4-gabc1234[-dirty]" if there are tags
#   - else fall back to the short hash + dirty marker
APP_VERSION="$(git describe --tags --always --dirty 2>/dev/null || echo "$(git rev-parse --short HEAD)$(git diff --quiet 2>/dev/null || echo -dirty)")"
GIT_COMMIT="$(git rev-parse --short HEAD)"

echo "Deploying APP_VERSION=$APP_VERSION GIT_COMMIT=$GIT_COMMIT"

pnpm run build
exec wrangler deploy \
  --var "APP_VERSION:$APP_VERSION" \
  --var "GIT_COMMIT:$GIT_COMMIT"

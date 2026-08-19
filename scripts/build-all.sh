#!/usr/bin/env bash

# VPSGUI Automated Build Script
# Repository: https://github.com/NotGamerPratham/vpsgui

set -e

echo "[VPSGUI Build] Starting monorepo build..."

# 1. Build Web Application
echo "[VPSGUI Build] Building Web Application..."
npm run build

# 2. Build Node.js SDK
if [ -d "sdk/node" ]; then
  echo "[VPSGUI Build] Building Node.js SDK (vpsgui-sdk)..."
  (cd sdk/node && npm run build)
fi

# 3. Verify Python SDK setup
if [ -d "sdk/python" ]; then
  echo "[VPSGUI Build] Verifying Python SDK structure..."
  ls -la sdk/python/vpsgui
fi

echo "[VPSGUI Build] All builds completed successfully!"

#!/usr/bin/env bash

# VPSGUI Docker Demo Launcher Script

set -e

echo "[VPSGUI Demo] Launching production container environment..."

if ! command -v docker &> /dev/null; then
    echo "[VPSGUI Demo] Error: Docker is required to run deploy-demo.sh."
    exit 1
fi

docker-compose up -d --build

echo "[VPSGUI Demo] Environment is live!"
echo "Web Workspace: http://localhost:80"
echo "API Gateway:   http://localhost:8080/api/v1"

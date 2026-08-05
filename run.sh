#!/usr/bin/env bash

# VPSGUI Setup & Execution Script for Linux VPS Deployment
# Repository: https://github.com/NotGamerPratham/vpsgui

set -e

echo "[VPSGUI] Starting VPSGUI Setup & Production Deployment..."

# 1. Check Node.js & npm
if ! command -v node &> /dev/null; then
    echo "[VPSGUI] Error: Node.js is not installed. Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "[VPSGUI] Node version: $(node -v)"
echo "[VPSGUI] npm version: $(npm -v)"

# 2. Install Project Dependencies
echo "[VPSGUI] Installing workspace dependencies..."
npm install

# 3. Grant Binaries Executable Permissions & Build Production Web Assets
echo "[VPSGUI] Setting binary permissions & building production web assets..."
chmod -R +x node_modules/.bin/ || true
npm run build

# 4. Install & Start Telemetry Agent Server on Port 8080
if [ -f "agent/install.sh" ]; then
    echo "[VPSGUI] Starting VPSGUI Agent Telemetry Service..."
    bash agent/install.sh || true
fi

# 5. Launch Option
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo "[VPSGUI] Docker detected. Launching VPSGUI via Docker Compose..."
    docker-compose up -d --build
    echo "[VPSGUI] VPSGUI is live via Docker at http://localhost:80"
else
    echo "[VPSGUI] Production web assets compiled to /var/www/vpsgui/dist."
fi

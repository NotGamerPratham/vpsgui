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

# 3. Build Production Web Assets
echo "[VPSGUI] Building production web assets..."
npm run build

# 4. Option: Launch via Docker Compose if Docker is available
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo "[VPSGUI] Docker detected. Launching VPSGUI via Docker Compose..."
    docker-compose up -d --build
    echo "[VPSGUI] VPSGUI is live via Docker at http://localhost:80"
else
    echo "[VPSGUI] Starting preview dev server on port 3000..."
    npm run dev -- --host 0.0.0.0 --port 3000
fi

#!/usr/bin/env bash

# VPSGUI Agent Connection & Health Diagnostic Script

TARGET_HOST="${1:-http://localhost:8080}"

echo "[VPSGUI Agent Diagnostic] Testing connection to ${TARGET_HOST}..."

# Test REST API Health
echo -n "[1/3] Testing REST API (/api/v1/nodes)... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${TARGET_HOST}/api/v1/nodes" || echo "000")

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 401 ]; then
    echo "OK (HTTP $HTTP_CODE)"
else
    echo "UNREACHABLE (HTTP $HTTP_CODE)"
fi

# Test System Telemetry Endpoint
echo -n "[2/3] Testing System Telemetry (/api/v1/system/telemetry)... "
TELEMETRY_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${TARGET_HOST}/api/v1/system/telemetry" || echo "000")
echo "HTTP $TELEMETRY_CODE"

# Test WebSocket Upgrade Header
echo -n "[3/3] Testing WebSocket Handshake (/ws)... "
WS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Upgrade: websocket" -H "Connection: Upgrade" "${TARGET_HOST}/ws" || echo "000")
echo "HTTP $WS_CODE"

echo "[VPSGUI Agent Diagnostic] Diagnostic complete."

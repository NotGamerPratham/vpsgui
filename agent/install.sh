#!/usr/bin/env bash
set -e

echo "Installing VPSGUI Linux Telemetry Agent (v1.4.2)..."

mkdir -p /etc/vpsgui /var/www/vpsgui/agent

AGENT_TOKEN=$(openssl rand -hex 24 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')

cat << EOF > /etc/systemd/system/vpsgui-agent.service
[Unit]
Description=VPSGUI Linux Infrastructure Telemetry Agent
After=network.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/vpsgui/agent
ExecStart=/usr/bin/node /var/www/vpsgui/agent/server.js
Restart=always
RestartSec=3s
Environment=PORT=46509
Environment=AGENT_TOKEN=${AGENT_TOKEN}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable vpsgui-agent
systemctl restart vpsgui-agent

echo "VPSGUI Agent successfully installed and active on port 46509!"
echo ""
echo "Agent Token (paste into the VPSGUI web UI under Settings -> Agent Token):"
echo "  ${AGENT_TOKEN}"

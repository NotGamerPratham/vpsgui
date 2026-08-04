#!/usr/bin/env bash
set -e

echo "Installing VPSGUI Linux Telemetry Agent (v1.4.2)..."

ARCH=$(uname -m)
if [ "$ARCH" != "x86_64" ] && [ "$ARCH" != "aarch64" ]; then
    echo "Unsupported architecture: $ARCH"
    exit 1
fi

mkdir -p /etc/vpsgui

echo "Downloading vpsgui-agent binary..."
curl -sSL -o /usr/local/bin/vpsgui-agent "https://github.com/vpsgui/vpsgui/releases/latest/download/vpsgui-agent-linux-amd64"
chmod +x /usr/local/bin/vpsgui-agent

cat << 'EOF' > /etc/systemd/system/vpsgui-agent.service
[Unit]
Description=VPSGUI Linux Infrastructure Telemetry Agent
After=network.target docker.service

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/vpsgui-agent --config /etc/vpsgui/agent.yaml
Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable vpsgui-agent
systemctl restart vpsgui-agent

echo "VPSGUI Agent successfully installed and active!"

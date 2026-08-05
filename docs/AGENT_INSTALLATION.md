# Linux VPS Agent Installation Guide

The `vpsgui-agent` is a lightweight daemon written in Go/Rust that runs on your Linux VPS to stream hardware metrics, manage Docker sockets, inspect systemd services, and execute remote operations.

## 1-Click Automated Linux Installer

Run the following command in your Linux VPS terminal:

```bash
curl -sSL https://raw.githubusercontent.com/NotGamerPratham/vpsgui/main/agent/install.sh | sudo bash
```

## Supported Operating Systems

- **Ubuntu**: 20.04 LTS, 22.04 LTS, 24.04 LTS
- **Debian**: 11 (Bullseye), 12 (Bookworm)
- **CentOS / RHEL / AlmaLinux / Rocky Linux**: 8.x, 9.x
- **Alpine Linux**: 3.16+
- **Arch Linux**: Latest

## Manual Installation via Systemd

1. Download the latest `vpsgui-agent` binary release:
   ```bash
   sudo wget -O /usr/local/bin/vpsgui-agent https://github.com/vpsgui/vpsgui/releases/latest/download/vpsgui-agent-linux-amd64
   sudo chmod +x /usr/local/bin/vpsgui-agent
   ```

2. Create configuration directory:
   ```bash
   sudo mkdir -p /etc/vpsgui
   ```

3. Create the Systemd unit file `/etc/systemd/system/vpsgui-agent.service`:
   ```ini
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
   ```

4. Enable and start the agent service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable vpsgui-agent
   sudo systemctl start vpsgui-agent
   ```

5. Verify service health status:
   ```bash
   sudo systemctl status vpsgui-agent
   ```

# VPSGUI Production Deployment Architecture & Security Guide

This document details the production deployment architecture, security hardening guidelines, and Nginx reverse proxy configuration for VPSGUI on Linux servers.

---

## Architecture Overview

```
[ Browser / Client ]
        │
        ├── HTTP Port 80 / HTTPS Port 443 ──> [ Nginx Reverse Proxy ]
        │                                             │
        │                                             ├── Static Dist Assets (/var/www/vpsgui/dist)
        │                                             └── /api/v1 & /ws ──> [ vpsgui-agent (Port 8080) ]
```

---

## 1-Click Automated Deployment

```bash
git clone https://github.com/NotGamerPratham/vpsgui.git
cd vpsgui
chmod +x run.sh
./run.sh
```

---

## Nginx Reverse Proxy Configuration (`/etc/nginx/sites-available/vpsgui`)

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/vpsgui/dist;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # REST API Proxy
    location /api/v1 {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Telemetry WebSocket Proxy
    location /ws {
        proxy_pass http://127.0.0.1:8080/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## Telemetry Agent Systemd Service (`/etc/systemd/system/vpsgui-agent.service`)

```ini
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
Environment=PORT=8080

[Install]
WantedBy=multi-user.target
```

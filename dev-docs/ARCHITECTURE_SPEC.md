# VPSGUI System Architecture Specification

## Overview

**VPSGUI** is an open-source **Open Infrastructure Workspace** engineered to provide single-pane control over Linux VPS servers, Docker containers, network topology, storage partitions, background automation, and system diagnostics.

Architected by **NotGamerPratham** ([notgamerpratham.com](https://notgamerpratham.com)).

---

## High-Level Architecture Diagram

```
+-----------------------------------------------------------------------+
|                              USER BROWSER                             |
|  React 18 + TypeScript + Tailwind + Lucide + Zustand + TanStack Query |
+-----------------------------------------------------------------------+
        |                                                   |
   REST API Requests                                   WebSocket Stream
   (Authorization: Bearer <JWT>)                       (Event-driven JSON)
        |                                                   |
        v                                                   v
+-----------------------------------------------------------------------+
|                       VPSGUI BACKEND API GATEWAY                      |
|                REST Endpoints (/api/v1) & Socket (/ws)                |
+-----------------------------------------------------------------------+
        |                                                   |
   System Calls & Systemd                              Docker Socket
   (/proc, /sys, ps, df, ufw)                          (/var/run/docker.sock)
        |                                                   |
        v                                                   v
+-----------------------------------------------------------------------+
|                             VPSGUI AGENT                              |
|          Lightweight Linux VPS Daemon (vpsgui-agent.service)          |
+-----------------------------------------------------------------------+
```

---

## Core Components

### 1. Web Workspace (`apps/web` / `src`)
- **Single Page Application (SPA)**: Built with React 18, Vite, and TypeScript.
- **Strict Zero-Mock Data Policy**: Telemetry, container lists, firewall rules, and process trees populate exclusively from backend REST endpoints (`/api/v1`) or WebSocket streams (`/ws`). Unattached states render clean onboarding empty states.
- **Dynamic Host Discovery**: Automatically targets `window.location.origin` or environment override `VITE_API_BASE_URL` to seamlessly discover the host server on deployment.

### 2. Linux VPS Daemon (`agent/`)
- Installed via 1-click installer: `curl -sSL https://get.vpsgui.dev/agent.sh | sudo bash`.
- Operates as systemd service `vpsgui-agent.service`.
- Reads real `/proc/stat`, `/proc/meminfo`, `/sys/class/net`, and system metrics.

### 3. Client SDKs (`sdk/`)
- **Node.js / TypeScript SDK**: Published as `@vpsgui/sdk` for npm.
- **Python SDK**: Published as `vpsgui` for PyPI.

---

## Security Model

- **Authentication**: JWT Bearer tokens with optional TOTP MFA.
- **Transport Security**: TLS/SSL via Nginx proxy or Certbot Let's Encrypt integration.
- **Least Privilege**: Agent runs under dedicated `vpsgui` system user with sudoers privileges limited to system inspection and container commands.

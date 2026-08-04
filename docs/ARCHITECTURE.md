# VPSGUI Architecture Documentation

VPSGUI is designed as an **Open Infrastructure Workspace** for managing Linux VPS nodes, Docker engines, container stacks, networking, and automated workflows from a single responsive interface.

## Monorepo Layout

```
VPSGUI/
├── apps/
│   ├── web/             # React + Vite Web Workspace Frontend
│   └── docs/            # Technical Documentation Portal
├── packages/
│   ├── ui/              # Reusable Atomic UI Component Library
│   ├── sdk/             # VPSGUI TypeScript SDK & API Client
│   ├── types/           # Domain TypeScript Interfaces
│   └── config/          # Shared ESLint, Tailwind, & TS Configurations
├── backend/
│   ├── api/             # REST API Gateway & Authentication
│   ├── gateway/         # Reverse Proxy & SSL Management
│   └── telemetry/       # High-throughput Metrics Ingestion Engine
├── agent/
│   ├── vpsgui-agent.go  # Lightweight Go/Rust Linux VPS Daemon
│   ├── install.sh       # 1-Click Automated Installer Script
│   └── systemd/         # Systemd Unit File (vpsgui-agent.service)
├── docs/                # Comprehensive Developer Documentation
├── deploy/              # Production Nginx & Infrastructure Manifests
└── docker-compose.yml   # Production Docker Container Setup
```

## System Data Flow

```
+-------------------------------------------------------------------+
|                        VPSGUI Web Frontend                        |
|   (React 18 + TypeScript + Zustand + Tailwind CSS + Lucide Icons) |
+-------------------------------------------------------------------+
                               |
               +---------------+---------------+
               | REST API                      | WebSocket (/ws)
               v                               v
+-------------------------------+   +-------------------------------+
|     API Gateway (/api/v1)     |   |   Telemetry Stream Engine     |
+-------------------------------+   +-------------------------------+
               |                               |
               +---------------+---------------+
                               |
                               v
+-------------------------------------------------------------------+
|                     Linux VPS Node (`vpsgui-agent`)               |
|      (CPU, RAM, Disk, Docker Socket, UFW Firewall, Systemd)       |
+-------------------------------------------------------------------+
```

## Event Bus & State Management

VPSGUI uses an in-memory typed Event Bus (`src/event-bus/index.ts`) coupled with Zustand stores:
- `useServerStore`: Node inventory, selection, filtering, favorites, and status updates.
- `useAuthStore`: Authenticated session, user profile, active organization, and security audit log timeline.
- `useUIStore`: Global active theme (VS Code Dark, Dracula, Catppuccin, Nord), Spotlight Command Palette modal state, Quick Launcher modal state, and Notifications Drawer.

## WebSocket Protocol Specification

WebSocket connections to `ws://host/ws` stream real-time JSON payloads:

```json
{
  "event": "telemetry_tick",
  "data": {
    "timestamp": "14:20:00",
    "cpuPercent": 24.5,
    "ramPercent": 48.2,
    "ramUsedMb": 1540,
    "ramTotalMb": 3200,
    "netRxKbps": 340,
    "netTxKbps": 890,
    "tempC": 42
  }
}
```

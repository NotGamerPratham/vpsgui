# VPSGUI — Open Infrastructure Workspace

<p align="center">
  <img src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80" alt="VPSGUI Infrastructure Banner" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/NotGamerPratham/vpsgui"><img src="https://img.shields.io/github/v/release/NotGamerPratham/vpsgui?style=flat-square&color=3B82F6" alt="Release" /></a>
  <a href="https://github.com/NotGamerPratham/vpsgui/actions"><img src="https://img.shields.io/badge/Build-Passing-10B981?style=flat-square&logo=github&logoColor=white" alt="Build Status" /></a>
  <a href="https://github.com/NotGamerPratham/vpsgui/blob/main/LICENSE"><img src="https://img.shields.io/github/license/NotGamerPratham/vpsgui?style=flat-square&color=10B981" alt="License" /></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://vitejs.dev"><img src="https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" /></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" /></a>
  <a href="https://go.dev"><img src="https://img.shields.io/badge/Go_Agent-1.22-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go Agent" /></a>
  <a href="https://notgamerpratham.com"><img src="https://img.shields.io/badge/Author-NotGamerPratham-FF4655?style=flat-square&logo=github&logoColor=white" alt="NotGamerPratham" /></a>
</p>

**VPSGUI** is a modern, production-ready, open-source **Open Infrastructure Workspace** for managing servers, containers, cloud resources, automation, and operations from a single unified workspace interface.

Developed by **[NotGamerPratham](https://notgamerpratham.com)**.

Repository: **[https://github.com/NotGamerPratham/vpsgui](https://github.com/NotGamerPratham/vpsgui)**

---

## 1-Click Setup & Execution

Run the setup script to install dependencies, build assets, and launch VPSGUI:

```bash
chmod +x run.sh && ./run.sh
```

Or deploy `vpsgui-agent` to any Linux VPS (`Ubuntu`, `Debian`, `CentOS`, `Alpine`, `Arch`):

```bash
curl -sSL https://raw.githubusercontent.com/NotGamerPratham/vpsgui/main/agent/install.sh | sudo bash
```

---

## Features

- **Nodes & Infrastructure Matrix**: Manage Linux VPS hosts, Docker servers, and Kubernetes clusters in grid, table, or dynamic 4-way comparison matrix views.
- **Interactive Topology Map**: Visual node graph rendering path connections (**Internet -> Load Balancers -> Compute Nodes -> Docker Engines & PostgreSQL Clusters**).
- **Spotlight Command Palette (`Ctrl+K`)**: VS Code inspired spotlight search modal for nodes, containers, system logs, and quick actions.
- **SSH Workbench Split Terminal**: Multi-tab terminal workbench with interactive command execution and saved snippet bar.
- **VS Code File Explorer**: Browse node filesystem trees (`/etc`, `/opt/stacks`), edit config files, and inspect permissions.
- **Open Infrastructure Catalog**: 1-Click deployment for applications, Docker container images, OS templates, and community plugins.
- **Infrastructure as Code (IaC) Exporter**: Declarative configuration exporter for **Terraform HCL**, **Ansible Playbooks**, **Docker Compose**, **Helm Charts**, and **Cloud-Init**.
- **Real Network Diagnostics**: Real DNS-over-HTTPS (DoH) resolution via Cloudflare (`1.1.1.1`), HTTP fetch ping timing, and port inspection.
- **Secrets & HashiCorp Vault Store**: Encrypted environment variables, secret API tokens, and deployment SSH keys.
- **Multi-Theme Engine**: Pre-loaded VS Code themes including **VS Code Dark**, **Dracula**, **Catppuccin**, **Nord**, **Atom One Dark**, and **Tokyo Night**.

---

## Monorepo Architecture

```
VPSGUI/
├── apps/
│   ├── web/             # React 18 + Vite + TypeScript Web Workspace
│   └── docs/            # Technical Documentation Portal
├── packages/
│   ├── ui/              # Reusable Atomic UI Component Library
│   ├── sdk/             # VPSGUI TypeScript SDK & REST Client
│   ├── types/           # Domain TypeScript Interfaces
│   └── config/          # Shared ESLint, Tailwind & TS Configuration
├── sdk/
│   ├── node/            # @vpsgui/sdk - Official Node.js/TypeScript SDK (npm)
│   └── python/          # vpsgui - Official Python SDK (PyPI)
├── backend/
│   ├── api/             # REST API Gateway & Authentication
│   ├── gateway/         # Reverse Proxy & SSL Management
│   └── telemetry/       # High-Throughput Telemetry Ingestion Engine
├── agent/
│   ├── vpsgui-agent.go  # Lightweight Go/Rust Linux VPS Daemon
│   ├── install.sh       # Automated Linux Installer Script
│   └── systemd/         # Systemd Unit File
├── docs/                # Developer Documentation Suite
├── deploy/              # Production Nginx Manifests
├── run.sh               # All-in-one Linux Setup Script
└── docker-compose.yml   # Production Docker Container Setup
```

---

## Quick Start (Development)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/NotGamerPratham/vpsgui.git
   cd vpsgui
   ```

2. **Run All-In-One Setup Script**:
   ```bash
   chmod +x run.sh && ./run.sh
   ```

---

## SDK Packages

VPSGUI provides official SDK client libraries for programmatic API access.

### Node.js / TypeScript (`@vpsgui/sdk`)

```bash
npm install @vpsgui/sdk
```

```typescript
import { VpsguiClient } from '@vpsgui/sdk';

const client = new VpsguiClient({
  baseUrl: 'https://your-vps-ip/api/v1',
  token: 'your-jwt-token',
});

const nodes = await client.nodes.list();
const containers = await client.docker.listContainers();
const telemetry = await client.system.telemetry();
```

[View full Node SDK docs](sdk/node/README.md)

### Python (`vpsgui`)

```bash
pip install vpsgui
```

```python
from vpsgui import VpsguiClient

client = VpsguiClient(
    base_url="https://your-vps-ip/api/v1",
    token="your-jwt-token",
)

nodes = client.nodes.list()
containers = client.docker.list_containers()
telemetry = client.system.telemetry()
```

[View full Python SDK docs](sdk/python/README.md)

---

## Technical Documentation

- [Architecture Overview](file:///docs/ARCHITECTURE.md)
- [Linux Agent Installation](file:///docs/AGENT_INSTALLATION.md)
- [REST & WebSocket API Reference](file:///docs/API_REFERENCE.md)
- [Developer Contribution Guide](file:///docs/DEVELOPMENT.md)
- [Security & RBAC Policy](file:///docs/SECURITY.md)

---

## Author & License

Developed by **[NotGamerPratham](https://notgamerpratham.com)**.

VPSGUI is open-source software released under the [MIT License](file:///LICENSE).

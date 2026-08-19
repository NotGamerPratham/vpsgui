# VPSGUI — Open Infrastructure Workspace

<p align="center">
  <img src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80" alt="VPSGUI Infrastructure Banner" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/NotGamerPratham/vpsgui/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-10B981?style=flat-square&logo=opensourceinitiative&logoColor=white" alt="MIT License" /></a>
  <a href="https://github.com/NotGamerPratham/vpsgui"><img src="https://img.shields.io/github/v/release/NotGamerPratham/vpsgui?style=flat-square&color=3B82F6" alt="Release" /></a>
  <a href="https://github.com/NotGamerPratham/vpsgui/actions/workflows/ci.yml"><img src="https://github.com/NotGamerPratham/vpsgui/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://vitejs.dev"><img src="https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" /></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node_Agent-18%2B-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js Agent" /></a>
  <a href="https://notgamerpratham.com"><img src="https://img.shields.io/badge/Author-NotGamerPratham-FF4655?style=flat-square&logo=github&logoColor=white" alt="NotGamerPratham" /></a>
</p>

**VPSGUI** is a modern, production-ready, open-source **Open Infrastructure Workspace** for managing servers, containers, cloud resources, automation, and operations from a single unified workspace interface.

Developed by **[NotGamerPratham](https://notgamerpratham.com)**.

Repository: **[https://github.com/NotGamerPratham/vpsgui](https://github.com/NotGamerPratham/vpsgui)**

---

## ⚠️ Before you deploy

VPSGUI's `vpsgui-agent` daemon executes shell commands, installs packages, controls systemd units
and Docker containers, and reads and writes files on the host. **The agent token is equivalent to a
root password.** Anyone who can reach the agent with that token owns the machine.

- Serve VPSGUI over **HTTPS**. The token is sent as a bearer header; over plain HTTP anything on the
  network path can capture it.
- Keep the agent on **loopback** (the default) behind the bundled nginx reverse proxy. Do not expose
  port 46509 to the internet.
- Put the UI behind a **VPN, firewall, or authenticating proxy**. The sign-in page is a local profile
  gate, not authentication — VPSGUI ships no user database, roles, or permissions.

See [docs/SECURITY.md](docs/SECURITY.md) for the full model and the hardening knobs.

---

## Setup

Requires **Node.js 18+**. Clone, then run the deploy script as root — it installs dependencies,
builds the frontend, publishes it to `/var/www/vpsgui/dist`, installs the agent as a systemd
service, and configures nginx:

```bash
git clone https://github.com/NotGamerPratham/vpsgui.git && cd vpsgui && sudo ./run.sh
```

To install only the agent on an additional Linux host, download and **read the script before running
it as root** — piping a remote script straight into `sudo bash` executes whatever the URL returns at
that moment, with no chance to inspect it:

```bash
curl -fsSLO https://raw.githubusercontent.com/NotGamerPratham/vpsgui/main/agent/install.sh
```

```bash
less install.sh && sudo bash install.sh
```

The installer prints an agent token on completion. Paste it into the web UI under
**Settings → Agent Token**; without it every privileged endpoint returns `401`.

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
│   ├── node/            # vpsgui-sdk - Official Node.js/TypeScript SDK (npm)
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

### Node.js / TypeScript (`vpsgui-sdk`)

```bash
npm install vpsgui-sdk
```

```typescript
import { VpsguiClient } from 'vpsgui-sdk';

const client = new VpsguiClient({
  baseUrl: 'https://your-vps-ip/api/v1',
  token: process.env.VPSGUI_AGENT_TOKEN,
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
import os
from vpsgui import VpsguiClient

client = VpsguiClient(
    base_url="https://your-vps-ip/api/v1",
    token=os.environ["VPSGUI_AGENT_TOKEN"],
)

nodes = client.nodes.list()
containers = client.docker.list_containers()
telemetry = client.system.telemetry()
```

[View full Python SDK docs](sdk/python/README.md)

---

## Technical Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Linux Agent Installation](docs/AGENT_INSTALLATION.md)
- [REST API Reference](docs/API_REFERENCE.md)
- [Developer Guide](docs/DEVELOPMENT.md)
- [Security Model](docs/SECURITY.md)

---

## Author & License

Developed by **[NotGamerPratham](https://notgamerpratham.com)**.

VPSGUI is open-source software released under the [MIT License](LICENSE).

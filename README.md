# VPSGUI - Open Infrastructure Workspace

<p align="center">
  <img src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80" alt="VPSGUI Infrastructure Banner" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/NotGamerPratham/vpsgui/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-10B981?style=flat-square&logo=opensourceinitiative&logoColor=white" alt="MIT License" /></a>
  <a href="https://github.com/NotGamerPratham/vpsgui/actions/workflows/ci.yml"><img src="https://github.com/NotGamerPratham/vpsgui/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/sponsors/NotGamerPratham"><img src="https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-EA4AAA?style=flat-square&logo=githubsponsors&logoColor=white" alt="Sponsor" /></a>
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
  gate, not authentication - VPSGUI ships no user database, roles, or permissions.

See [docs/SECURITY.md](docs/SECURITY.md) for the full model and the hardening knobs.

### Dashboard sign-in

The sign-in screen is now real authentication, not a local profile gate.

- Accounts live in `/opt/vpsgui/agent/users.db` - a `0600` JSON file. Passwords
  are hashed with **scrypt** (N=16384, r=8, per-user random salt) and compared in
  constant time. Nothing stores a password in plaintext, and the file is on the
  agent's credential deny-list, so the file manager refuses it even with
  `AGENT_FILE_ROOTS=/`.
- The browser gets an **HttpOnly, SameSite=Strict** session cookie it cannot
  read, so an injected script cannot steal the session and a cross-site request
  never carries it. Sessions last 12 hours, are held in memory only (a restart
  signs everyone out), and are stored as a SHA-256 digest rather than the token.
- Failed sign-ins share the agent's lockout: 10 attempts locks that client out
  for 5 minutes. Unknown usernames are verified against a decoy hash so the
  response time cannot be used to enumerate accounts.
- **Creating the first account requires the agent token**, and is only possible
  while no account exists. There is no open registration endpoint.

Create it from the browser on first visit, or directly:

```bash
curl -X POST http://127.0.0.1:46509/api/v1/auth/bootstrap   -H "Authorization: Bearer $(sudo grep -oP 'AGENT_TOKEN=\K.*' /opt/vpsgui/agent/agent.env)"   -H 'Content-Type: application/json'   -d '{"username":"admin","password":"choose-something-long"}'
```

The agent token keeps working alongside this for the SDKs and scripts, and it
remains root-equivalent - dashboard accounts do not replace it or reduce it.

---

## Setup

Requires **Node.js 18+**. Clone, then run the deploy script as root - it installs dependencies,
builds the frontend, publishes it to `/var/www/vpsgui/dist`, installs the agent as a systemd
service, and configures nginx:

```bash
git clone https://github.com/NotGamerPratham/vpsgui.git && cd vpsgui && sudo ./run.sh
```

To install only the agent on an additional Linux host, download and **read the script before running
it as root** - piping a remote script straight into `sudo bash` executes whatever the URL returns at
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
│   ├── node/            # vpsgui - Official CLI + Node.js/TypeScript SDK (npm)
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

## Node or Bun

Everything here runs on **Node.js 18+** or on **Bun 1.2+**. Node is the default
and what `run.sh` installs on a server; Bun is supported for local development
and is roughly three times faster to build.

```bash
bun install && bun run test && bun --bun run build
```

`bun run <script>` executes the package scripts, but note two details:

- **`bun run` does not shim `node`.** A script that names `node` explicitly —
  such as `agent:start` - still launches Node. Use `bun run agent:start:bun` on a
  machine that has only Bun.
- **`--bun` is what makes Bun run the tooling.** Vite's binary carries a
  `#!/usr/bin/env node` shebang, which Bun honours by default, so a plain
  `bun run build` quietly builds on Node. `bun --bun run build` runs Vite itself
  on Bun.

The build output is byte-for-byte identical either way, and CI runs the whole
suite plus the agent under both runtimes.

The one place they genuinely differed: `fs.realpath` on a Windows drive root
returns `F:\` on Node and `F:` on Bun. The agent normalises that before its
path-confinement check - without it, running the agent on Bun refused to list
its own configured root.

---

## Command line

Both SDK packages install a `vpsgui` command. They are the same CLI and share
`~/.vpsgui/config.json`, so it does not matter which one wins on your `PATH`.

```bash
npm i -g vpsgui
# or
pip install vpsgui

vpsgui login vps.example.com
```

`login` reads the agent token with echo off, verifies it against the agent, and only then writes it
to disk with mode `0600` - nothing is saved if the credentials do not work.

```bash
vpsgui status                      # CPU, memory, disk, failing checks
vpsgui health                      # exits non-zero on a red check
vpsgui ps                          # docker containers
vpsgui ls /etc                     # list a directory on the host
vpsgui exec 'systemctl status nginx'
```

Several hosts are several profiles; `--profile` works on every command. In CI, set
`VPSGUI_API_URL` and `VPSGUI_AGENT_TOKEN` instead of logging in - they take precedence over any
saved profile, so nothing touches the disk.

---

## SDK Packages

VPSGUI provides official SDK client libraries for programmatic API access.

### Node.js / TypeScript (`vpsgui`)

```bash
npm install vpsgui
```

```typescript
import { VpsguiClient } from 'vpsgui';

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

## 💖 Sponsor VPSGUI Development

VPSGUI is 100% free and open-source software created and maintained by **[NotGamerPratham](https://notgamerpratham.com)**. If VPSGUI saves you time or powers your server infrastructure, consider sponsoring its ongoing development!

<p align="center">
  <a href="https://buymeacoffee.com/notgamerpratham">
    <img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-notgamerpratham-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black" alt="Buy Me a Coffee" />
  </a>
  <a href="https://github.com/sponsors/NotGamerPratham">
    <img src="https://img.shields.io/badge/Sponsor%20VPSGUI-GitHub%20Sponsors-EA4AAA?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="Sponsor VPSGUI on GitHub Sponsors" />
  </a>
  <a href="https://notgamerpratham.com">
    <img src="https://img.shields.io/badge/Support%20Author-NotGamerPratham-FF4655?style=for-the-badge&logo=github&logoColor=white" alt="Support Author NotGamerPratham" />
  </a>
</p>

---

## 🤝 Contributors

Everyone below has commits in this repository. The table is regenerated straight from the GitHub
API by [`.github/workflows/contributors.yml`](.github/workflows/contributors.yml) on every push to
`main` and once a day, so it stays current without anyone editing it by hand.

<!-- CONTRIBUTORS:START - generated by scripts/update-contributors.mjs, do not edit by hand -->

<table>
  <tbody>
    <tr>
      <td align="center">
        <a href="https://github.com/NotGamerPratham">
          <img src="https://avatars.githubusercontent.com/u/178252675?v=4&s=160" width="80" height="80" alt="NotGamerPratham" style="border-radius:50%" /><br />
          <sub><b>NotGamerPratham</b></sub>
        </a><br />
        <sub>66 commits</sub>
      </td>
    </tr>
  </tbody>
</table>

<sub><b>1</b> contributor · <b>66</b> commits · updated automatically from the GitHub API</sub>

<!-- CONTRIBUTORS:END -->

<p align="center">
  <a href="https://github.com/NotGamerPratham/vpsgui/graphs/contributors">Full contributor graph</a>
</p>

Want to contribute to VPSGUI? Check out our [CONTRIBUTING.md](CONTRIBUTING.md) guide!

---

## Author & License

Developed by **[NotGamerPratham](https://notgamerpratham.com)**.

VPSGUI is open-source software released under the [MIT License](LICENSE).


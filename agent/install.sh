#!/usr/bin/env bash
#
# VPSGUI Linux Telemetry Agent installer.
#
# Installs agent/server.js as a systemd service. The agent grants root-equivalent control of this
# host (shell execution, package install, file read/write), so by default it binds to loopback only
# and is expected to sit behind the bundled nginx reverse proxy.

set -euo pipefail

AGENT_VERSION="1.5.0"
INSTALL_DIR="/opt/vpsgui/agent"
SERVICE_FILE="/etc/systemd/system/vpsgui-agent.service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing VPSGUI Linux Telemetry Agent (v${AGENT_VERSION})..."

if [ "$(id -u)" -ne 0 ]; then
  echo "Error: this installer must run as root (try: sudo bash agent/install.sh)" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is not installed or not on PATH. Install Node.js 18+ first." >&2
  exit 1
fi

NODE_BIN="$(command -v node)"

# The agent uses fs/promises and logical-assignment syntax. On an older Node it dies with a syntax
# error at startup, which surfaces only as an unexplained 502 from nginx — fail loudly here instead.
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "${NODE_MAJOR}" -lt 18 ]; then
  echo "Error: Node.js 18+ is required (found $(node -v 2>/dev/null || echo 'none'))." >&2
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs" >&2
  exit 1
fi

if [ ! -f "${SCRIPT_DIR}/server.js" ]; then
  echo "Error: ${SCRIPT_DIR}/server.js not found. Run this script from the cloned repository." >&2
  exit 1
fi

# The previous installer created an empty directory and wrote a unit pointing at
# /var/www/vpsgui/agent/server.js without ever copying the file there, so the service crash-looped.
echo "Copying agent to ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}"
install -m 0644 "${SCRIPT_DIR}/server.js" "${INSTALL_DIR}/server.js"
install -m 0644 "${SCRIPT_DIR}/package.json" "${INSTALL_DIR}/package.json"
# A bare `[ -f x ] && cmd` as a top-level statement aborts the whole script under `set -e` when the
# test fails, silently skipping everything below it — including the service restart.
if [ -f "${SCRIPT_DIR}/server.cjs" ]; then
  install -m 0644 "${SCRIPT_DIR}/server.cjs" "${INSTALL_DIR}/server.cjs"
fi

# Reuse an existing token across upgrades so operators do not have to re-paste it into the web UI.
if [ -f "${SERVICE_FILE}" ] && grep -q '^Environment=AGENT_TOKEN=' "${SERVICE_FILE}"; then
  AGENT_TOKEN="$(sed -n 's/^Environment=AGENT_TOKEN=//p' "${SERVICE_FILE}" | head -n1)"
  echo "Reusing the existing agent token from ${SERVICE_FILE}."
else
  AGENT_TOKEN="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
fi

if [ -z "${AGENT_TOKEN}" ]; then
  echo "Error: failed to generate an agent token." >&2
  exit 1
fi

cat > "${SERVICE_FILE}" << EOF
[Unit]
Description=VPSGUI Linux Infrastructure Telemetry Agent
Documentation=https://github.com/NotGamerPratham/vpsgui
After=network.target docker.service

[Service]
Type=simple
# The agent reports on systemd units, installs apt packages, and executes shell commands, so it
# needs root. Everything it exposes is gated behind AGENT_TOKEN — treat that token as a root password.
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=${NODE_BIN} ${INSTALL_DIR}/server.js
Restart=always
RestartSec=3s

Environment=PORT=46509
# Loopback only. The bundled nginx config proxies to 127.0.0.1:46509 and terminates TLS.
# Change to 0.0.0.0 ONLY if you front the agent with TLS and a firewall.
Environment=AGENT_HOST=127.0.0.1
Environment=AGENT_TOKEN=${AGENT_TOKEN}
# Directories the file manager may browse. Narrow this list to reduce blast radius.
Environment=AGENT_FILE_ROOTS=/etc,/var/www,/var/log,/home,/opt,/srv
# Set to 0 to disable the Terminal page's arbitrary shell execution endpoint.
Environment=AGENT_ENABLE_SHELL=1

# Hardening. The agent still runs as root, but these limit what a compromise can reach.
NoNewPrivileges=yes
PrivateTmp=yes
ProtectHome=read-only
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
RestrictRealtime=yes
LockPersonality=yes

[Install]
WantedBy=multi-user.target
EOF

# The unit file embeds the token; systemd unit files are world-readable (0644) by default, which
# would expose it to every local user.
chmod 600 "${SERVICE_FILE}"

systemctl daemon-reload
systemctl enable vpsgui-agent >/dev/null
systemctl restart vpsgui-agent

sleep 1
if ! systemctl is-active --quiet vpsgui-agent; then
  echo "Error: vpsgui-agent failed to start. Inspect: journalctl -u vpsgui-agent -n 50" >&2
  # A stale process squatting on the port is a common cause: systemd's copy cannot bind and
  # crash-loops while the old one keeps answering with outdated code.
  echo "" >&2
  echo "If something else is already bound to port 46509, stop it first:" >&2
  ss -tlnp 2>/dev/null | grep 46509 >&2 || true
  exit 1
fi

# Confirm the daemon now answering on the port is the build we just installed. Restarting the unit
# is not proof: a manually started `node agent/server.js` from an earlier session keeps the port and
# serves old code, which looks identical from the outside except that new endpoints still 404.
RUNNING_VERSION="$(
  curl -fsS -H "Authorization: Bearer ${AGENT_TOKEN}" \
    "http://127.0.0.1:46509/api/v1/agent/info" 2>/dev/null |
    sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
)"

if [ -z "${RUNNING_VERSION}" ]; then
  echo "Error: the agent is running but did not answer /api/v1/agent/info." >&2
  echo "Something older is likely bound to port 46509. Check: ss -tlnp | grep 46509" >&2
  exit 1
fi

if [ "${RUNNING_VERSION}" != "${AGENT_VERSION}" ]; then
  echo "Error: port 46509 is served by agent v${RUNNING_VERSION}, but v${AGENT_VERSION} was just installed." >&2
  echo "An old process is holding the port. Find and stop it, then re-run this installer:" >&2
  ss -tlnp 2>/dev/null | grep 46509 >&2 || true
  exit 1
fi

echo ""
echo "VPSGUI Agent v${AGENT_VERSION} installed and verified serving on 127.0.0.1:46509."
echo ""
echo "Agent Token (paste into the VPSGUI web UI under Settings -> Agent Token):"
echo "  ${AGENT_TOKEN}"
echo ""
echo "This token grants root-equivalent control of this host. Treat it as a root password,"
echo "and serve the web UI over HTTPS so it is not sent in cleartext."

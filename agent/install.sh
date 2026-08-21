#!/usr/bin/env bash
#
# VPSGUI Linux Telemetry Agent installer.
#
# Installs agent/server.js and supervises it with either pm2 or systemd. The agent grants
# root-equivalent control of this host (shell execution, package install, file read/write), so by
# default it binds to loopback only and is expected to sit behind the bundled nginx reverse proxy.
#
#   AGENT_PROCESS_MANAGER=pm2|systemd   which supervisor to use (default: pm2)
#
# Only ONE supervisor may own the agent: two of them race for port 46509, and the loser
# crash-loops while the winner keeps serving stale code. This script therefore always tears the
# other one down before starting its own.

set -euo pipefail

INSTALL_DIR="/opt/vpsgui/agent"
SERVICE_FILE="/etc/systemd/system/vpsgui-agent.service"
# Single source of truth for the agent's configuration, read by BOTH supervisors. 0600 because it
# contains the token, which is equivalent to a root password.
ENV_FILE="${INSTALL_DIR}/agent.env"
PM2_APP_NAME="vpsgui-agent"
PROCESS_MANAGER="${AGENT_PROCESS_MANAGER:-pm2}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "${PROCESS_MANAGER}" != "pm2" ] && [ "${PROCESS_MANAGER}" != "systemd" ]; then
  echo "Error: AGENT_PROCESS_MANAGER must be 'pm2' or 'systemd' (got '${PROCESS_MANAGER}')." >&2
  exit 1
fi

if [ ! -f "${SCRIPT_DIR}/server.js" ]; then
  echo "Error: ${SCRIPT_DIR}/server.js not found. Run this script from the cloned repository." >&2
  exit 1
fi

# Read from server.js rather than hardcoding a second copy here. The two used to drift - this
# script once compared the freshly installed agent against a version string one release behind,
# which failed every deploy with a false "an old process is holding the port".
AGENT_VERSION="$(sed -n "s/^const AGENT_VERSION = '\(.*\)';/\1/p" "${SCRIPT_DIR}/server.js" | head -n1)"
if [ -z "${AGENT_VERSION}" ]; then
  echo "Error: could not read AGENT_VERSION out of ${SCRIPT_DIR}/server.js." >&2
  exit 1
fi

echo "Installing VPSGUI Linux Telemetry Agent (v${AGENT_VERSION}) under ${PROCESS_MANAGER}..."

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
# error at startup, which surfaces only as an unexplained 502 from nginx - fail loudly here instead.
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "${NODE_MAJOR}" -lt 18 ]; then
  echo "Error: Node.js 18+ is required (found $(node -v 2>/dev/null || echo 'none'))." >&2
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs" >&2
  exit 1
fi

# The original installer created an empty directory and wrote a unit pointing at
# /var/www/vpsgui/agent/server.js without ever copying the file there, so the service crash-looped.
echo "Copying agent to ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}"
install -m 0644 "${SCRIPT_DIR}/server.js" "${INSTALL_DIR}/server.js"
install -m 0644 "${SCRIPT_DIR}/package.json" "${INSTALL_DIR}/package.json"
# A bare `[ -f x ] && cmd` as a top-level statement aborts the whole script under `set -e` when the
# test fails, silently skipping everything below it - including the service restart.
if [ -f "${SCRIPT_DIR}/server.cjs" ]; then
  install -m 0644 "${SCRIPT_DIR}/server.cjs" "${INSTALL_DIR}/server.cjs"
fi

# server.cjs is the documented entry point; it re-exports server.js so both work.
ENTRY_POINT="${INSTALL_DIR}/server.cjs"
[ -f "${ENTRY_POINT}" ] || ENTRY_POINT="${INSTALL_DIR}/server.js"

# --- Token ------------------------------------------------------------------
# Reuse an existing token across upgrades so operators do not have to re-paste it into the web UI.
# Check the env file first, then the legacy systemd unit (migration path from older installs).
AGENT_TOKEN=""
if [ -f "${ENV_FILE}" ] && grep -q '^AGENT_TOKEN=' "${ENV_FILE}"; then
  AGENT_TOKEN="$(sed -n 's/^AGENT_TOKEN=//p' "${ENV_FILE}" | head -n1)"
  echo "Reusing the existing agent token from ${ENV_FILE}."
elif [ -f "${SERVICE_FILE}" ] && grep -q '^Environment=AGENT_TOKEN=' "${SERVICE_FILE}"; then
  AGENT_TOKEN="$(sed -n 's/^Environment=AGENT_TOKEN=//p' "${SERVICE_FILE}" | head -n1)"
  echo "Migrating the existing agent token out of ${SERVICE_FILE}."
else
  AGENT_TOKEN="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
fi

if [ -z "${AGENT_TOKEN}" ]; then
  echo "Error: failed to generate an agent token." >&2
  exit 1
fi

# Carry forward existing settings rather than resetting them. Rewriting this file wholesale on every
# deploy silently reverted any operator change to the roots, host, or shell switch.
read_env_value() {
  if [ -f "${ENV_FILE}" ]; then
    sed -n "s/^$1=//p" "${ENV_FILE}" | head -n1
  fi
}

# Precedence: an explicitly exported variable wins, then whatever is already stored, then the
# default. Without the first tier there would be no way to change a setting on an existing install
# short of hand-editing the file, since the stored value would always win.
#   sudo AGENT_FILE_ROOTS=/ ./run.sh
AGENT_PORT_VALUE="${PORT:-$(read_env_value PORT)}"
AGENT_HOST_VALUE="${AGENT_HOST:-$(read_env_value AGENT_HOST)}"
AGENT_ROOTS_VALUE="${AGENT_FILE_ROOTS:-$(read_env_value AGENT_FILE_ROOTS)}"
AGENT_SHELL_VALUE="${AGENT_ENABLE_SHELL:-$(read_env_value AGENT_ENABLE_SHELL)}"
AGENT_IPINFO_VALUE="${AGENT_IPINFO_TOKEN:-$(read_env_value AGENT_IPINFO_TOKEN)}"

# Defaults on a fresh install. AGENT_FILE_ROOTS defaults to the whole filesystem: this is a host
# administration tool, and a narrow list makes ordinary paths fail with "outside the configured
# agent file roots". Narrow it here to reduce blast radius if you prefer.
: "${AGENT_PORT_VALUE:=46509}"
: "${AGENT_HOST_VALUE:=127.0.0.1}"
: "${AGENT_ROOTS_VALUE:=/}"
: "${AGENT_SHELL_VALUE:=1}"
# Empty by default. This is an API credential, so it is never committed to the repository.
: "${AGENT_IPINFO_VALUE:=}"

# Written before the supervisor starts, since both read their configuration from it.
umask 077
cat > "${ENV_FILE}" << EOF
# VPSGUI agent configuration. Read by both the systemd unit and the pm2 process.
# This file contains a token equivalent to a root password - keep it mode 0600.
PORT=${AGENT_PORT_VALUE}
# Loopback only. The bundled nginx config proxies to 127.0.0.1:46509 and terminates TLS.
# Change to 0.0.0.0 ONLY if you front the agent with TLS and a firewall.
AGENT_HOST=${AGENT_HOST_VALUE}
AGENT_TOKEN=${AGENT_TOKEN}
# Directories the file manager may browse. "/" means the whole filesystem, which is the default for
# a host administration tool. Narrow it (e.g. /etc,/var/www,/home,/opt,/srv) to reduce blast radius.
# The credential deny list still applies at any setting: shadow, sudoers, SSH private keys, and the
# agent's own token and secret key are never served.
AGENT_FILE_ROOTS=${AGENT_ROOTS_VALUE}
# Set to 0 to disable the Terminal page's arbitrary shell execution endpoint.
AGENT_ENABLE_SHELL=${AGENT_SHELL_VALUE}
# Optional ipinfo.io token for IP geolocation. It is held here rather than in the frontend because
# every VITE_* value is inlined into the public client bundle at build time, where anyone could read
# it. Set with: sudo AGENT_IPINFO_TOKEN=<token> ./run.sh
# Without it the agent falls back to the keyless ipapi.co.
AGENT_IPINFO_TOKEN=${AGENT_IPINFO_VALUE}
EOF
chmod 600 "${ENV_FILE}"
umask 022

# --- Supervisor -------------------------------------------------------------

stop_systemd_agent() {
  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files 2>/dev/null | grep -q '^vpsgui-agent\.service'; then
    echo "Stopping the systemd unit so it cannot compete for port 46509..."
    systemctl disable --now vpsgui-agent >/dev/null 2>&1 || true
  fi
}

stop_pm2_agent() {
  if command -v pm2 >/dev/null 2>&1 && pm2 describe "${PM2_APP_NAME}" >/dev/null 2>&1; then
    echo "Removing the pm2 process so it cannot compete for port 46509..."
    pm2 delete "${PM2_APP_NAME}" >/dev/null 2>&1 || true
    pm2 save --force >/dev/null 2>&1 || true
  fi
}

if [ "${PROCESS_MANAGER}" = "pm2" ]; then
  stop_systemd_agent

  if ! command -v pm2 >/dev/null 2>&1; then
    # pm2 is published on npm and is NOT in the Debian/Ubuntu archives, so `apt install pm2`
    # fails with "Unable to locate package pm2". npm is the supported distribution channel.
    echo "pm2 not found. Installing it globally via npm..."
    if ! npm install -g pm2; then
      echo "Error: failed to install pm2. Install it manually with: npm install -g pm2" >&2
      exit 1
    fi
  fi
  echo "pm2 version: $(pm2 --version 2>/dev/null || echo unknown)"

  # Load the agent config so pm2 captures it into the saved process definition.
  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a

  pm2 delete "${PM2_APP_NAME}" >/dev/null 2>&1 || true
  pm2 start "${ENTRY_POINT}" \
    --name "${PM2_APP_NAME}" \
    --cwd "${INSTALL_DIR}" \
    --time \
    --update-env

  # Persist the process list and install the boot hook, so the agent survives a reboot.
  pm2 save --force
  if ! pm2 startup systemd -u root --hp /root >/dev/null 2>&1; then
    echo "Warning: 'pm2 startup' failed; the agent will NOT restart automatically after a reboot." >&2
    echo "         Run 'pm2 startup' manually and follow its instructions." >&2
  fi

  sleep 2
  if ! pm2 describe "${PM2_APP_NAME}" 2>/dev/null | grep -q "online"; then
    echo "Error: the pm2 process is not online. Inspect: pm2 logs ${PM2_APP_NAME} --lines 50" >&2
    ss -tlnp 2>/dev/null | grep 46509 >&2 || true
    exit 1
  fi
else
  stop_pm2_agent

  cat > "${SERVICE_FILE}" << EOF
[Unit]
Description=VPSGUI Linux Infrastructure Telemetry Agent
Documentation=https://github.com/NotGamerPratham/vpsgui
After=network.target docker.service

[Service]
Type=simple
# The agent reports on systemd units, installs apt packages, and executes shell commands, so it
# needs root. Everything it exposes is gated behind AGENT_TOKEN - treat that token as a root password.
User=root
WorkingDirectory=${INSTALL_DIR}
# Configuration (including the token) lives in the 0600 env file rather than inline here, so the
# unit file itself carries no secret and both supervisors read the same values.
EnvironmentFile=${ENV_FILE}
ExecStart=${NODE_BIN} ${ENTRY_POINT}
Restart=always
RestartSec=3s

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

  chmod 644 "${SERVICE_FILE}"
  systemctl daemon-reload
  systemctl enable vpsgui-agent >/dev/null
  systemctl restart vpsgui-agent

  sleep 1
  if ! systemctl is-active --quiet vpsgui-agent; then
    echo "Error: vpsgui-agent failed to start. Inspect: journalctl -u vpsgui-agent -n 50" >&2
    echo "" >&2
    echo "If something else is already bound to port 46509, stop it first:" >&2
    ss -tlnp 2>/dev/null | grep 46509 >&2 || true
    exit 1
  fi
fi

# --- Verification -----------------------------------------------------------
# Confirm the daemon now answering on the port is the build we just installed. Starting the
# supervisor is not proof: a leftover process from an earlier session keeps the port and serves old
# code, which looks identical from the outside except that new endpoints still 404.
check_running_version() {
  RUNNING_VERSION=""
  for _ in $(seq 1 15); do
    RUNNING_VERSION="$(
      curl -fsS -H "Authorization: Bearer ${AGENT_TOKEN}" \
        "http://127.0.0.1:46509/api/v1/agent/info" 2>/dev/null |
        sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
    )"
    [ -n "${RUNNING_VERSION}" ] && break
    sleep 1
  done
}

# The PID currently bound to 46509, per `ss` - empty if `ss` is missing or nothing is listening.
port_holder_pid() {
  ss -tlnp 2>/dev/null | grep ':46509 ' | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | head -n1
}

# True only if $1 is a node process running THIS agent - never anything else. This host may also
# run other node apps under the same pm2 (n8n, custom services, ...), so both the interpreter and
# the entry script are checked before this installer ever offers to stop anything.
is_our_agent_process() {
  local pid="$1" cmdline
  [ -n "${pid}" ] || return 1
  [ -r "/proc/${pid}/cmdline" ] || return 1
  cmdline="$(tr '\0' ' ' < "/proc/${pid}/cmdline" 2>/dev/null)"
  case "${cmdline}" in
    *node*server.js*|*node*server.cjs*) return 0 ;;
    *) return 1 ;;
  esac
}

restart_supervisor() {
  if [ "${PROCESS_MANAGER}" = "pm2" ]; then
    pm2 restart "${PM2_APP_NAME}" >/dev/null 2>&1 || true
  else
    systemctl restart vpsgui-agent >/dev/null 2>&1 || true
  fi
}

check_running_version

if [ -z "${RUNNING_VERSION}" ]; then
  echo "Error: the agent is running but did not answer /api/v1/agent/info." >&2
  echo "Something older is likely bound to port 46509. Check: ss -tlnp | grep 46509" >&2
  if [ "${PROCESS_MANAGER}" = "pm2" ]; then
    echo "Logs: pm2 logs ${PM2_APP_NAME} --lines 50" >&2
  else
    echo "Logs: journalctl -u vpsgui-agent -n 50" >&2
  fi
  exit 1
fi

if [ "${RUNNING_VERSION}" != "${AGENT_VERSION}" ]; then
  echo "Error: port 46509 is served by agent v${RUNNING_VERSION}, but v${AGENT_VERSION} was just installed." >&2
  ss -tlnp 2>/dev/null | grep ':46509 ' >&2 || true

  HOLDER_PID="$(port_holder_pid)"

  # Offer to stop it only when every one of these holds: this is an interactive terminal (never
  # auto-kill in an unattended `curl | bash` or CI run), exactly one PID owns the port, and that
  # PID is confirmed - by its own /proc/<pid>/cmdline, not by assumption - to be this agent and
  # nothing else that happens to be running on the box.
  if [ -t 0 ] && [ -n "${HOLDER_PID}" ] && is_our_agent_process "${HOLDER_PID}"; then
    echo "" >&2
    read -r -p "Stop process ${HOLDER_PID} and retry? [y/N] " REPLY
    case "${REPLY}" in
      [yY]|[yY][eE][sS])
        echo "Stopping ${HOLDER_PID}..." >&2
        kill "${HOLDER_PID}" 2>/dev/null || true
        for _ in $(seq 1 10); do
          kill -0 "${HOLDER_PID}" 2>/dev/null || break
          sleep 0.5
        done
        kill -0 "${HOLDER_PID}" 2>/dev/null && kill -9 "${HOLDER_PID}" 2>/dev/null || true

        restart_supervisor
        check_running_version

        if [ "${RUNNING_VERSION}" = "${AGENT_VERSION}" ]; then
          echo "Recovered: v${AGENT_VERSION} is now serving on 127.0.0.1:46509." >&2
        else
          echo "Error: still not serving v${AGENT_VERSION} after stopping ${HOLDER_PID}." >&2
          echo "Check: ss -tlnp | grep 46509" >&2
          exit 1
        fi
        ;;
      *)
        echo "Left ${HOLDER_PID} running. Stop it manually, then re-run this installer." >&2
        exit 1
        ;;
    esac
  else
    echo "An old process is holding the port. Find and stop it, then re-run this installer:" >&2
    [ -n "${HOLDER_PID}" ] && echo "  (pid ${HOLDER_PID} - could not confirm it is this agent, so it was not touched)" >&2
    exit 1
  fi
fi

echo ""
echo "VPSGUI Agent v${AGENT_VERSION} installed and verified serving on 127.0.0.1:46509 (${PROCESS_MANAGER})."
echo ""
echo "Agent Token (paste into the VPSGUI web UI under Settings -> Agent Token):"
echo "  ${AGENT_TOKEN}"
echo ""
echo "Configuration: ${ENV_FILE}"
if [ "${PROCESS_MANAGER}" = "pm2" ]; then
  echo "Manage:        pm2 restart ${PM2_APP_NAME} | pm2 logs ${PM2_APP_NAME} | pm2 status"
else
  echo "Manage:        systemctl restart vpsgui-agent | journalctl -u vpsgui-agent -f"
fi
echo ""
echo "This token grants root-equivalent control of this host. Treat it as a root password,"
echo "and serve the web UI over HTTPS so it is not sent in cleartext."

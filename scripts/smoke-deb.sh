#!/usr/bin/env bash
#
# Install the built .deb with apt and prove the result actually works, then purge it.
#
#   sudo scripts/smoke-deb.sh out/vpsgui_1.6.0_amd64.deb
#
# Needs a real systemd host (a VM, WSL2 with systemd, or a GitHub-hosted runner) with nginx
# installable; Node.js is bundled in the package. Destructive by design: it installs and purges
# vpsgui. Do not point it
# at a machine whose vpsgui install you want to keep.

set -uo pipefail

DEB="${1:?usage: smoke-deb.sh <path-to.deb>}"
[ "$(id -u)" -eq 0 ] || { echo "Run as root." >&2; exit 1; }
DEB="$(readlink -f "${DEB}")"

export DEBIAN_FRONTEND=noninteractive
FAIL=0
pass() { printf '  ok    %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; FAIL=1; }
check() { # check <description> <command...>
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then pass "${desc}"; else fail "${desc}"; fi
}
token() { sed -n 's/^AGENT_TOKEN=//p' /opt/vpsgui/agent/agent.env; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

ROOT_MODE="$(stat -c %a /)"
echo "== install =="
apt-get install -y "${DEB}" >/tmp/smoke-install.log 2>&1 || { cat /tmp/smoke-install.log; fail "apt install"; exit 1; }
pass "apt install"

WANT="$(sed -n "s/^const AGENT_VERSION = '\(.*\)';/\1/p" /opt/vpsgui/agent/server.js | head -n1)"
TOKEN="$(token)"
AUTH="Authorization: Bearer ${TOKEN}"

check "filesystem root mode unchanged" test "$(stat -c %a /)" = "${ROOT_MODE}"
check "agent.env is mode 0600"            test "$(stat -c %a /opt/vpsgui/agent/agent.env)" = 600
check "token is 64 hex characters"         test "${#TOKEN}" -eq 64
check "unit is active"                      systemctl is-active --quiet vpsgui-agent
check "unit is enabled"                     systemctl is-enabled --quiet vpsgui-agent
check "nginx config valid"                  nginx -t
# The package bundles its own Node.js; the service must be running that one, not whatever the
# distro happens to have (which may be absent or ancient).
for _ in $(seq 1 15); do PID="$(systemctl show -p MainPID --value vpsgui-agent)"; [ "${PID:-0}" != 0 ] && break; sleep 1; done
check "agent runs the bundled node"         test "$(readlink -f "/proc/${PID:-0}/exe")" = /opt/vpsgui/node/bin/node
check "package does not depend on nodejs"   bash -c "! dpkg-query -W -f='\${Depends}' vpsgui | grep -qi nodejs"

echo "== through nginx =="
# The agent can take a moment to bind after the unit reports active.
for _ in $(seq 1 15); do [ "$(code http://127.0.0.1/api/v1/health)" = 200 ] && break; sleep 1; done
check "console index returns 200"          test "$(code http://127.0.0.1/)" = 200
check "health returns 200"                 test "$(code http://127.0.0.1/api/v1/health)" = 200
check "no token is rejected (401)"         test "$(code http://127.0.0.1/api/v1/system/telemetry)" = 401
check "wrong token is rejected (401)"      test "$(code -H 'Authorization: Bearer wrong' http://127.0.0.1/api/v1/system/telemetry)" = 401
GOT="$(curl -s -H "${AUTH}" http://127.0.0.1/api/v1/agent/info | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
check "running agent is v${WANT} (got '${GOT}')" test "${GOT}" = "${WANT}"

ASSET="$(ls /var/www/vpsgui/dist/assets/*.js 2>/dev/null | head -n1 | xargs -r basename)"
for path in / "/assets/${ASSET}" /api/v1/health; do
  HDRS="$(curl -sI "http://127.0.0.1${path}" | tr -d '\r')"
  for h in Content-Security-Policy X-Content-Type-Options X-Frame-Options; do
    check "${h} present on ${path}" grep -qi "^${h}:" <<<"${HDRS}"
  done
done

# Larger than the 8m nginx used to allow, smaller than the agent's 100 MB cap.
head -c $((12 * 1024 * 1024)) /dev/urandom >/tmp/smoke-upload.bin
check "12 MB upload passes nginx" test "$(code -X POST -H "${AUTH}" -H 'Content-Type: application/octet-stream' \
  --data-binary @/tmp/smoke-upload.bin 'http://127.0.0.1/api/v1/files/upload?path=/var/tmp/vpsgui-smoke.bin&overwrite=1')" = 200
rm -f /tmp/smoke-upload.bin /var/tmp/vpsgui-smoke.bin

echo "== reinstall keeps the token =="
apt-get install -y --reinstall "${DEB}" >/dev/null 2>&1
check "token unchanged after reinstall" test "$(token)" = "${TOKEN}"

echo "== purge =="
mkdir -p /var/backups/vpsgui && touch /var/backups/vpsgui/.smoke-keep
apt-get purge -y vpsgui >/dev/null 2>&1
check "agent stopped"                       test "$(systemctl is-active vpsgui-agent 2>/dev/null)" != active
check "/opt/vpsgui removed"                 test ! -e /opt/vpsgui
check "web root removed"                    test ! -e /var/www/vpsgui
check "nginx vhost removed"                 test ! -e /etc/nginx/sites-available/vpsgui
check "backups left alone"                  test -e /var/backups/vpsgui/.smoke-keep
rm -rf /var/backups/vpsgui
check "nginx still valid"                   nginx -t

echo
if [ "${FAIL}" -eq 0 ]; then echo "SMOKE TEST PASSED"; else echo "SMOKE TEST FAILED" >&2; exit 1; fi

#!/usr/bin/env bash
#
# Install the built .rpm with dnf/yum and prove the result actually works, then remove it.
# The RPM counterpart of smoke-deb.sh.
#
#   sudo scripts/smoke-rpm.sh out/vpsgui-1.6.0-1.x86_64.rpm
#
# Needs a real systemd host on the RHEL family (Rocky, Alma, CentOS Stream, Fedora, ...) where
# nginx is installable. Node.js is bundled. Destructive by design: it installs and removes vpsgui
# and deletes /opt/vpsgui at the end. Do not point it at a machine whose install you want to keep.

set -uo pipefail

RPM="${1:?usage: smoke-rpm.sh <path-to.rpm>}"
[ "$(id -u)" -eq 0 ] || { echo "Run as root." >&2; exit 1; }
RPM="$(readlink -f "${RPM}")"

PM=dnf; command -v dnf >/dev/null 2>&1 || PM=yum
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
${PM} install -y "${RPM}" >/tmp/smoke-install.log 2>&1 || { cat /tmp/smoke-install.log; fail "${PM} install"; exit 1; }
pass "${PM} install"

WANT="$(sed -n "s/^const AGENT_VERSION = '\(.*\)';/\1/p" /opt/vpsgui/agent/server.js | head -n1)"
TOKEN="$(token)"
AUTH="Authorization: Bearer ${TOKEN}"

check "filesystem root mode unchanged" test "$(stat -c %a /)" = "${ROOT_MODE}"
check "agent.env is mode 0600"            test "$(stat -c %a /opt/vpsgui/agent/agent.env)" = 600
check "token is 64 hex characters"         test "${#TOKEN}" -eq 64
check "unit is active"                      systemctl is-active --quiet vpsgui-agent
check "unit is enabled"                     systemctl is-enabled --quiet vpsgui-agent
check "nginx is running"                    systemctl is-active --quiet nginx
check "nginx config valid"                  nginx -t
check "vhost is in conf.d"                  test -f /etc/nginx/conf.d/vpsgui.conf
for _ in $(seq 1 15); do PID="$(systemctl show -p MainPID --value vpsgui-agent)"; [ "${PID:-0}" != 0 ] && break; sleep 1; done
check "agent runs the bundled node"         test "$(readlink -f "/proc/${PID:-0}/exe")" = /opt/vpsgui/node/bin/node
check "package does not require nodejs"     bash -c "! rpm -q --requires vpsgui | grep -qi nodejs"

echo "== through nginx =="
for _ in $(seq 1 15); do [ "$(code http://127.0.0.1/api/v1/health)" = 200 ] && break; sleep 1; done
check "console index returns 200"          test "$(code http://127.0.0.1/)" = 200
check "health returns 200"                 test "$(code http://127.0.0.1/api/v1/health)" = 200
check "no token is rejected (401)"         test "$(code http://127.0.0.1/api/v1/system/telemetry)" = 401
check "wrong token is rejected (401)"      test "$(code -H 'Authorization: Bearer wrong' http://127.0.0.1/api/v1/system/telemetry)" = 401
GOT="$(curl -s -H "${AUTH}" http://127.0.0.1/api/v1/agent/info | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
check "running agent is v${WANT} (got '${GOT}')" test "${GOT}" = "${WANT}"

ASSET="$(basename "$(ls /var/www/vpsgui/dist/assets/*.js 2>/dev/null | head -n1)")"
for path in / "/assets/${ASSET}" /api/v1/health; do
  HDRS="$(curl -sI "http://127.0.0.1${path}" | tr -d '\r')"
  for h in Content-Security-Policy X-Content-Type-Options X-Frame-Options; do
    check "${h} present on ${path}" grep -qi "^${h}:" <<<"${HDRS}"
  done
done

head -c $((12 * 1024 * 1024)) /dev/urandom >/tmp/smoke-upload.bin
check "12 MB upload passes nginx" test "$(code -X POST -H "${AUTH}" -H 'Content-Type: application/octet-stream' \
  --data-binary @/tmp/smoke-upload.bin 'http://127.0.0.1/api/v1/files/upload?path=/var/tmp/vpsgui-smoke.bin&overwrite=1')" = 200
rm -f /tmp/smoke-upload.bin /var/tmp/vpsgui-smoke.bin

echo "== reinstall keeps the token =="
${PM} reinstall -y "${RPM}" >/dev/null 2>&1
check "token unchanged after reinstall" test "$(token)" = "${TOKEN}"
check "agent active after reinstall"    systemctl is-active --quiet vpsgui-agent

echo "== remove =="
mkdir -p /var/backups/vpsgui && touch /var/backups/vpsgui/.smoke-keep
${PM} remove -y vpsgui >/dev/null 2>&1
check "agent stopped"                       test "$(systemctl is-active vpsgui-agent 2>/dev/null)" != active
check "program files removed"               test ! -e /opt/vpsgui/node
check "web root removed"                    test ! -e /var/www/vpsgui
check "vhost no longer served"              test ! -e /etc/nginx/conf.d/vpsgui.conf
check "token kept for a reinstall"          test "$(token)" = "${TOKEN}"
check "backups left alone"                  test -e /var/backups/vpsgui/.smoke-keep
# dnf also removes dependencies nothing else needs, which can include nginx itself.
check "nginx config valid, if nginx remains" bash -c "command -v nginx >/dev/null || exit 0; nginx -t"
rm -rf /var/backups/vpsgui /opt/vpsgui /etc/nginx/conf.d/vpsgui.conf.disabled

echo
if [ "${FAIL}" -eq 0 ]; then echo "SMOKE TEST PASSED"; else echo "SMOKE TEST FAILED" >&2; exit 1; fi

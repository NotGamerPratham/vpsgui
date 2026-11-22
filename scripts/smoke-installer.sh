#!/usr/bin/env bash
#
# End-to-end test of scripts/install.sh against a local "release": a tampered checksum is refused,
# a good one installs, a second run upgrades in place keeping the token, a wrong-architecture
# archive is refused, and --uninstall / --purge behave. Runs on any systemd Linux with python3 (or RHEL 8's platform-python);
# destructive (installs, then removes, vpsgui).
#
#   sudo scripts/smoke-installer.sh out/vpsgui-1.6.0-linux-x64.tar.gz

set -uo pipefail

TARBALL="${1:?usage: smoke-installer.sh <vpsgui-VER-linux-ARCH.tar.gz>}"
[ "$(id -u)" -eq 0 ] || { echo "Run as root." >&2; exit 1; }
TARBALL="$(readlink -f "${TARBALL}")"
cd "$(dirname "${BASH_SOURCE[0]}")/.."
FILE="$(basename "${TARBALL}")"
VER="$(echo "${FILE}" | sed -n 's/^vpsgui-\(.*\)-linux-.*/\1/p')"
[ -n "${VER}" ] || { echo "Cannot read the version from '${FILE}'." >&2; exit 1; }

PASS=0; FAILN=0
ok()   { echo "  ok    $1"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL  $1"; FAILN=$((FAILN+1)); }
chk()  { local d="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$d"; else bad "$d"; fi; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
token() { sed -n 's/^AGENT_TOKEN=//p' /opt/vpsgui/agent/agent.env; }

ROOT_MODE="$(stat -c %a /)"   # an install must never change the mode of the filesystem root
# RHEL 8 minimal images ship no python3 command, only platform-python (same http.server).
PY="$(command -v python3 || command -v python || ls /usr/libexec/platform-python 2>/dev/null || true)"
[ -n "${PY}" ] || { echo "Need python3 (or platform-python) to serve the test release." >&2; exit 1; }
GOOD="$(mktemp -d)"; BAD="$(mktemp -d)"
cleanup() { pkill -f "http.server 88(01|02)" 2>/dev/null; rm -rf "${GOOD}" "${BAD}" "/tmp/vpsgui-${VER}-linux-arm64.tar.gz"; }
trap cleanup EXIT

# One archive, served twice: once with its real checksum, once with a wrong one.
cp "${TARBALL}" "${GOOD}/"; ( cd "${GOOD}" && sha256sum "${FILE}" > SHA256SUMS )
cp "${TARBALL}" "${BAD}/"
echo "0000000000000000000000000000000000000000000000000000000000000000  ${FILE}" > "${BAD}/SHA256SUMS"
( cd "${GOOD}" && setsid "${PY}" -m http.server 8801 --bind 127.0.0.1 >/dev/null 2>&1 & )
( cd "${BAD}"  && setsid "${PY}" -m http.server 8802 --bind 127.0.0.1 >/dev/null 2>&1 & )
for _ in 1 2 3 4 5 6 7 8 9 10; do curl -fs -o /dev/null http://127.0.0.1:8801/SHA256SUMS && break; sleep 1; done

echo "== tampered checksum is refused =="
VPSGUI_BASE_URL=http://127.0.0.1:8802 sh scripts/install.sh --version "${VER}" >/tmp/smoke-bad.log 2>&1
chk "installer exits non-zero" test $? -ne 0
chk "says checksum mismatch"   grep -q "checksum mismatch" /tmp/smoke-bad.log
chk "nothing was installed"    test ! -e /opt/vpsgui/node

echo "== --version is required with a custom base URL =="
VPSGUI_BASE_URL=http://127.0.0.1:8801 sh scripts/install.sh >/tmp/smoke-nover.log 2>&1
chk "refuses without --version" grep -q "version X.Y.Z is required" /tmp/smoke-nover.log

echo "== install from the good release =="
VPSGUI_BASE_URL=http://127.0.0.1:8801 sh scripts/install.sh --version "${VER}" >/tmp/smoke-inst.log 2>&1
chk "installer succeeds"        test $? -eq 0
chk "verified the checksum"     grep -q "checksum OK" /tmp/smoke-inst.log
TOKEN="$(token)"
chk "agent.env is mode 0600"    test "$(stat -c %a /opt/vpsgui/agent/agent.env)" = 600
chk "token is 64 hex"           test "${#TOKEN}" -eq 64
chk "unit active"               systemctl is-active --quiet vpsgui-agent
chk "unit enabled"              systemctl is-enabled --quiet vpsgui-agent
chk "unit file in /etc/systemd" test -f /etc/systemd/system/vpsgui-agent.service
for _ in 1 2 3 4 5 6 7 8 9 10; do PID="$(systemctl show -p MainPID --value vpsgui-agent)"; [ "${PID:-0}" != 0 ] && break; sleep 1; done
chk "runs the bundled node"     test "$(readlink -f "/proc/${PID:-0}/exe")" = /opt/vpsgui/node/bin/node
chk "nginx running"             systemctl is-active --quiet nginx
for _ in $(seq 1 15); do [ "$(code http://127.0.0.1/api/v1/health)" = 200 ] && break; sleep 1; done
chk "health 200 via nginx"      test "$(code http://127.0.0.1/api/v1/health)" = 200
chk "filesystem root mode unchanged" test "$(stat -c %a /)" = "${ROOT_MODE}"
# The console itself, not just the proxy: nginx adds security headers even to its own error pages,
# so a header check alone would pass while every file is unreadable by the worker user.
chk "console index returns 200"  test "$(code http://127.0.0.1/)" = 200
ASSET="$(basename "$(ls /var/www/vpsgui/dist/assets/*.js 2>/dev/null | head -n1)")"
chk "a static asset returns 200" test "$(code "http://127.0.0.1/assets/${ASSET}")" = 200
chk "no token -> 401"           test "$(code http://127.0.0.1/api/v1/system/telemetry)" = 401
chk "token accepted"            test "$(code -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1/api/v1/system/telemetry)" = 200
chk "security headers on /"     bash -c "curl -sI http://127.0.0.1/ | grep -qi '^content-security-policy'"

echo "== running it again upgrades in place, token kept =="
VPSGUI_BASE_URL=http://127.0.0.1:8801 sh scripts/install.sh --version "${VER}" >/tmp/smoke-inst2.log 2>&1
chk "second run succeeds"       test $? -eq 0
chk "token unchanged"           test "$(token)" = "${TOKEN}"
chk "agent active"              systemctl is-active --quiet vpsgui-agent

echo "== a wrong-architecture archive is refused =="
cp "${TARBALL}" "/tmp/vpsgui-${VER}-linux-arm64.tar.gz"
case "$(uname -m)" in aarch64|arm64) WRONG="x64" ;; *) WRONG="arm64" ;; esac
cp "${TARBALL}" "/tmp/vpsgui-${VER}-linux-${WRONG}.tar.gz"
sh scripts/install.sh --tarball "/tmp/vpsgui-${VER}-linux-${WRONG}.tar.gz" >/tmp/smoke-arch.log 2>&1
chk "refused with a clear message" grep -q "not built for this CPU" /tmp/smoke-arch.log
rm -f "/tmp/vpsgui-${VER}-linux-${WRONG}.tar.gz"

echo "== --uninstall keeps data; --purge removes it =="
sh scripts/install.sh --uninstall >/tmp/smoke-un.log 2>&1
chk "agent stopped"             test "$(systemctl is-active vpsgui-agent 2>/dev/null)" != active
chk "program files gone"        test ! -e /opt/vpsgui/node
chk "unit file gone"            test ! -e /etc/systemd/system/vpsgui-agent.service
chk "web root gone"             test ! -e /var/www/vpsgui
chk "vhost no longer served"    bash -c "! [ -e /etc/nginx/conf.d/vpsgui.conf ] && ! [ -e /etc/nginx/sites-enabled/vpsgui ]"
chk "token kept"                test "$(token)" = "${TOKEN}"
chk "nginx still valid"         nginx -t
mkdir -p /var/backups/vpsgui; touch /var/backups/vpsgui/.smoke-keep
sh scripts/install.sh --uninstall --purge >/tmp/smoke-purge.log 2>&1
chk "purge removes /opt/vpsgui" test ! -e /opt/vpsgui
chk "filesystem root mode still unchanged" test "$(stat -c %a /)" = "${ROOT_MODE}"
chk "backups untouched"         test -e /var/backups/vpsgui/.smoke-keep
rm -rf /var/backups/vpsgui /etc/nginx/sites-available/vpsgui /etc/nginx/conf.d/vpsgui.conf.disabled

echo; echo "passed=${PASS} failed=${FAILN}"
if [ "${FAILN}" -eq 0 ]; then echo "INSTALLER SMOKE TEST PASSED"; else echo "INSTALLER SMOKE TEST FAILED" >&2; exit 1; fi

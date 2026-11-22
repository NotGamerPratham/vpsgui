#!/usr/bin/env bash
#
# Build the vpsgui .deb from the working tree.
#
#   npm run build                      # produces dist/
#   scripts/build-deb.sh [ver] [arch]  # produces out/vpsgui_<version>_<arch>.deb
#
# Version: first argument, else VPSGUI_VERSION, else the version in package.json. A leading "v" (as
# in a git tag) is stripped. Arch: second argument, else DEB_ARCH, else amd64; one of amd64, arm64,
# armhf. Needs dpkg-deb, so run it on Debian/Ubuntu (CI does) - but any host can build any arch,
# because the only arch-specific part is the Node.js binary that is downloaded and bundled.
#
# Node.js is bundled rather than depended on. The distro package cannot be relied on: Ubuntu 20.04
# ships Node 10, 22.04 ships 12, and a hard "nodejs (>= 18)" would make apt refuse the install on
# most of the servers people actually run. The bundled binary lives under /opt/vpsgui/node and is
# used only by the agent; it does not touch or replace any system Node.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

VERSION="${1:-${VPSGUI_VERSION:-}}"
if [ -z "${VERSION}" ]; then
  VERSION="$(node -p "require('./package.json').version")"
fi
VERSION="${VERSION#v}"

ARCH="${2:-${DEB_ARCH:-amd64}}"
# shellcheck source=lib/node-bundle.sh
. "${ROOT}/scripts/lib/node-bundle.sh"
node_pin "${ARCH}" || exit 1

# Debian versions must start with a digit and contain only [A-Za-z0-9.+~:-]. Anything else makes
# dpkg-deb fail with a message that does not name the cause.
if ! printf '%s' "${VERSION}" | grep -Eq '^[0-9][A-Za-z0-9.+~-]*$'; then
  echo "Error: '${VERSION}' is not a valid Debian package version." >&2
  exit 1
fi

if ! command -v dpkg-deb >/dev/null 2>&1; then
  echo "Error: dpkg-deb not found. Build on Debian/Ubuntu (apt install dpkg-dev)." >&2
  exit 1
fi

if [ ! -f dist/index.html ]; then
  echo "Error: dist/index.html is missing. Run 'npm run build' first." >&2
  exit 1
fi
if ! ls dist/assets/*.js >/dev/null 2>&1; then
  echo "Error: dist/assets has no JavaScript bundle. Run 'npm run build' first." >&2
  exit 1
fi

PKG="vpsgui"
STAGE="$(mktemp -d)"
trap 'rm -rf "${STAGE}"' EXIT
OUT_DIR="${ROOT}/out"
mkdir -p "${OUT_DIR}"

# --- Payload --------------------------------------------------------------------------------
install -d -m 0755 "${STAGE}/opt/vpsgui/agent"
install -m 0644 agent/server.js   "${STAGE}/opt/vpsgui/agent/server.js"
install -m 0644 agent/server.cjs  "${STAGE}/opt/vpsgui/agent/server.cjs"
install -m 0644 agent/package.json "${STAGE}/opt/vpsgui/agent/package.json"

# --- Bundled Node.js ------------------------------------------------------------------------
bundle_node "${ROOT}" "${STAGE}"

install -d -m 0755 "${STAGE}/var/www/vpsgui"
cp -r dist "${STAGE}/var/www/vpsgui/dist"
# a+rX: nginx runs as www-data and needs to read every file and traverse every directory.
chmod -R a+rX,u+w,go-w "${STAGE}/var/www/vpsgui"

install -d -m 0755 "${STAGE}/usr/share/vpsgui"
install -m 0644 deploy/nginx.conf "${STAGE}/usr/share/vpsgui/nginx.conf"

install -d -m 0755 "${STAGE}/lib/systemd/system"
install -m 0644 packaging/common/vpsgui-agent.service "${STAGE}/lib/systemd/system/vpsgui-agent.service"

install -d -m 0755 "${STAGE}/usr/share/doc/${PKG}"
install -m 0644 LICENSE "${STAGE}/usr/share/doc/${PKG}/copyright"

# --- Control --------------------------------------------------------------------------------
install -d -m 0755 "${STAGE}/DEBIAN"
INSTALLED_SIZE="$(du -sk "${STAGE}" | cut -f1)"

cat > "${STAGE}/DEBIAN/control" <<CONTROL
Package: ${PKG}
Version: ${VERSION}
Section: admin
Priority: optional
Architecture: ${ARCH}
Depends: libc6 (>= 2.28), libstdc++6 (>= ${LIBSTDCXX_MIN}), nginx | nginx-light | nginx-full | nginx-extras, openssl
Recommends: curl
Installed-Size: ${INSTALLED_SIZE}
Maintainer: NotGamerPratham <notgamerpratham@gmail.com>
Homepage: https://github.com/NotGamerPratham/vpsgui
Description: Self-hosted web console for Linux servers and Docker
 VPSGUI is a control plane for a Linux server: live telemetry read from /proc,
 a host shell, a file manager, Docker, firewall rules, an encrypted secret
 store and backups, served by a zero-dependency Node.js agent behind nginx.
 Node.js is bundled, so no distribution Node package is needed.
 .
 The agent grants root-equivalent control of the host. It binds to loopback
 only, and everything except /health requires its token. Serve the site over
 TLS before signing in from anywhere but localhost.
CONTROL

for script in postinst prerm postrm; do
  install -m 0755 "packaging/debian/${script}" "${STAGE}/DEBIAN/${script}"
done

# md5sums lets `debsums` and `dpkg --verify` detect tampering with the installed files.
( cd "${STAGE}" && find . -path ./DEBIAN -prune -o -type f -print0 | sort -z | xargs -0 md5sum | sed 's# \./# #' ) \
  > "${STAGE}/DEBIAN/md5sums"
chmod 0644 "${STAGE}/DEBIAN/md5sums"

# --root-owner-group: files in the package belong to root regardless of who built it.
DEB="${OUT_DIR}/${PKG}_${VERSION}_${ARCH}.deb"
dpkg-deb --root-owner-group --build "${STAGE}" "${DEB}" >/dev/null

echo "Built ${DEB}"
dpkg-deb --info "${DEB}" | sed -n '1,/^ Description/p' | sed 's/^/  /'

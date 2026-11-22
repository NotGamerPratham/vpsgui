#!/usr/bin/env bash
#
# Build the portable tarball that scripts/install.sh installs from.
#
#   npm run build
#   scripts/build-tarball.sh [ver] [arch]   # -> out/vpsgui-<ver>-linux-<node-arch>.tar.gz
#
# Arch: amd64, arm64 or armhf (default amd64); the file name uses Node's names (x64, arm64,
# armv7l) because that is what a user's `uname -m` maps onto. The archive holds the same tree the
# .deb and .rpm install, rooted at "/": extract it over / and run /opt/vpsgui/bin/vpsgui-setup.
# install.sh does exactly that after checking the host and installing nginx.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

VERSION="${1:-${VPSGUI_VERSION:-}}"
[ -n "${VERSION}" ] || VERSION="$(node -p "require('./package.json').version")"
VERSION="${VERSION#v}"
ARCH="${2:-${DEB_ARCH:-amd64}}"

# shellcheck source=lib/node-bundle.sh
. "${ROOT}/scripts/lib/node-bundle.sh"
node_pin "${ARCH}" || exit 1
# shellcheck source=lib/stage-payload.sh
. "${ROOT}/scripts/lib/stage-payload.sh"

[ -f dist/index.html ] || { echo "Error: dist/index.html is missing. Run 'npm run build' first." >&2; exit 1; }

STAGE="$(mktemp -d)"
trap 'rm -rf "${STAGE}"' EXIT
OUT_DIR="${ROOT}/out"
mkdir -p "${OUT_DIR}"

stage_payload "${STAGE}"
bundle_node "${ROOT}" "${STAGE}"
install -d -m 0755 "${STAGE}/etc/systemd/system"
install -m 0644 packaging/common/vpsgui-agent.service "${STAGE}/etc/systemd/system/vpsgui-agent.service"
install -d -m 0755 "${STAGE}/usr/share/doc/vpsgui"
install -m 0644 LICENSE "${STAGE}/usr/share/doc/vpsgui/copyright"
printf '%s\n' "${VERSION}" > "${STAGE}/opt/vpsgui/VERSION"

TGZ="${OUT_DIR}/vpsgui-${VERSION}-linux-${NODE_ARCH}.tar.gz"
# Name the top-level directories instead of archiving ".". The staging directory is a mktemp -d,
# mode 0700; archiving it as "./" and extracting as root onto / makes tar chmod the real root
# directory to 0700, after which no non-root process (nginx's workers included) can traverse the
# filesystem. install.sh also extracts with --no-overwrite-dir, so this is belt and braces.
# --owner/--group 0: files belong to root whoever built them.
tar -C "${STAGE}" --owner=0 --group=0 --numeric-owner -czf "${TGZ}" etc opt usr var
echo "Built ${TGZ}"
( cd "${OUT_DIR}" && sha256sum "$(basename "${TGZ}")" )

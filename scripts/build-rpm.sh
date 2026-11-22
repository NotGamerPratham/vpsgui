#!/usr/bin/env bash
#
# Build the vpsgui .rpm from the working tree.
#
#   npm run build                      # produces dist/
#   scripts/build-rpm.sh [ver] [arch]  # produces out/vpsgui-<version>-1.<arch>.rpm
#
# Version: first argument, else VPSGUI_VERSION, else package.json; a leading "v" is stripped.
# Arch: second argument, else RPM_ARCH, else x86_64; one of x86_64, aarch64. Needs rpmbuild
# (apt install rpm, dnf install rpm-build), but any host can build any arch: the only
# arch-specific part is the Node.js binary that is downloaded and bundled.
#
# The payload is the same tree build-deb.sh ships (Node bundled, agent, console, nginx template,
# unit, vpsgui-setup). Only the container differs.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

VERSION="${1:-${VPSGUI_VERSION:-}}"
if [ -z "${VERSION}" ]; then
  VERSION="$(node -p "require('./package.json').version")"
fi
VERSION="${VERSION#v}"

RPM_ARCH="${2:-${RPM_ARCH:-x86_64}}"
case "${RPM_ARCH}" in
  x86_64)  DEB_EQ=amd64 ;;
  aarch64) DEB_EQ=arm64 ;;
  *) echo "Error: unsupported arch '${RPM_ARCH}' (x86_64, aarch64)." >&2; exit 1 ;;
esac
# shellcheck source=lib/node-bundle.sh
. "${ROOT}/scripts/lib/node-bundle.sh"
node_pin "${DEB_EQ}" || exit 1

# RPM versions may not contain '-'; '~' (pre-release) is fine on rpm >= 4.10.
if ! printf '%s' "${VERSION}" | grep -Eq '^[0-9][A-Za-z0-9.+~_]*$'; then
  echo "Error: '${VERSION}' is not a valid RPM version." >&2
  exit 1
fi
command -v rpmbuild >/dev/null 2>&1 || { echo "Error: rpmbuild not found (apt install rpm / dnf install rpm-build)." >&2; exit 1; }
[ -f dist/index.html ] || { echo "Error: dist/index.html is missing. Run 'npm run build' first." >&2; exit 1; }
ls dist/assets/*.js >/dev/null 2>&1 || { echo "Error: dist/assets has no JavaScript bundle. Run 'npm run build' first." >&2; exit 1; }

STAGE="$(mktemp -d)"
TOPDIR="$(mktemp -d)"
trap 'rm -rf "${STAGE}" "${TOPDIR}"' EXIT
OUT_DIR="${ROOT}/out"
mkdir -p "${OUT_DIR}"

# shellcheck source=lib/stage-payload.sh
. "${ROOT}/scripts/lib/stage-payload.sh"
stage_payload "${STAGE}"
bundle_node "${ROOT}" "${STAGE}"
install -d -m 0755 "${STAGE}/usr/lib/systemd/system"
install -m 0644 packaging/common/vpsgui-agent.service "${STAGE}/usr/lib/systemd/system/vpsgui-agent.service"
install -d -m 0755 "${STAGE}/usr/share/licenses/vpsgui"
install -m 0644 LICENSE "${STAGE}/usr/share/licenses/vpsgui/LICENSE"

# xz, not rpm 6's zstd default: older rpm (RHEL 7/8) cannot read zstd payloads. _rpmformat 4 keeps
# the classic package format those same hosts understand.
rpmbuild -bb packaging/rpm/vpsgui.spec \
  --target "${RPM_ARCH}" \
  --define "_topdir ${TOPDIR}" \
  --define "vpsgui_version ${VERSION}" \
  --define "vpsgui_stage ${STAGE}" \
  --define "_binary_payload w6.xzdio" \
  --define "_rpmformat 4" \
  --define "_buildhost vpsgui" \
  --define "_binary_filedigest_algorithm 8" \
  >/dev/null

RPM="$(ls "${TOPDIR}"/RPMS/*/vpsgui-*.rpm)"
cp "${RPM}" "${OUT_DIR}/"
FINAL="${OUT_DIR}/$(basename "${RPM}")"
echo "Built ${FINAL}"
rpm -qp --info "${FINAL}" 2>/dev/null | sed -n '1,/^Description/p' | sed 's/^/  /' || true
echo "  Requires:"; rpm -qp --requires "${FINAL}" 2>/dev/null | sort -u | sed 's/^/    /' || true

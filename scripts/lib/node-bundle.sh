# Sourced by build-deb.sh, build-rpm.sh and build-tarball.sh - not executable on its own.
#
# One place that knows which Node.js every package bundles, so the hashes cannot drift between
# formats. Pinned, not "latest": a build must be reproducible, and the hash is what makes a swapped
# or corrupted download fail loudly. Bump NODE_VERSION and all three hashes together
# (https://nodejs.org/dist/v<ver>/SHASUMS256.txt). Node 22 needs glibc >= 2.28 (Debian 10, RHEL 8,
# Ubuntu 20.04) - that floor, not the distro's own Node, is what bounds support.
NODE_VERSION="22.23.4"

# node_pin <amd64|arm64|armhf>  - Debian architecture names; the other formats map onto them.
# LIBSTDCXX_MIN is the libstdc++6 that provides the newest GLIBCXX symbol each binary imports,
# read with `readelf --dyn-syms -W node | grep -o GLIBCXX_[0-9.]*`: 3.4.21 (GCC 5) on amd64/arm64,
# 3.4.26 (GCC 9) on armhf.
node_pin() {
  case "$1" in
    amd64) NODE_ARCH=x64;    LIBSTDCXX_MIN=5.2; NODE_SHA256=1805bcd35e6815559bd2eb97db438d3fdb0eb3a5e6a977b7c1badca76337e9ce ;;
    arm64) NODE_ARCH=arm64;  LIBSTDCXX_MIN=5.2; NODE_SHA256=6287aa46b6c375d816e63ae66d024fbbfd70404825aabdfdf898a970871d2f4b ;;
    armhf) NODE_ARCH=armv7l; LIBSTDCXX_MIN=9;   NODE_SHA256=c9057c6a3b8fbb9651ed115c1e96d4a7281b7b9c9ca89fa05865c98ed7ffd437 ;;
    *) echo "Error: unsupported arch '$1' (amd64, arm64, armhf)." >&2; return 1 ;;
  esac
}

# bundle_node <root> <stage>  - downloads (cached), verifies and installs bin/node + LICENSE under
# <stage>/opt/vpsgui/node. Call node_pin first. <root> is the repo root, for the default cache.
bundle_node() {
  local root="$1" stage="$2" cache tgz
  cache="${VPSGUI_CACHE:-${root}/.cache}"
  mkdir -p "${cache}"
  tgz="${cache}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
  if ! { [ -f "${tgz}" ] && echo "${NODE_SHA256}  ${tgz}" | sha256sum -c --status; }; then
    echo "Fetching Node.js v${NODE_VERSION} (${NODE_ARCH})..."
    curl -fsSL -o "${tgz}.part" "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
    mv "${tgz}.part" "${tgz}"
  fi
  echo "${NODE_SHA256}  ${tgz}" | sha256sum -c --status \
    || { echo "Error: Node.js download failed its SHA-256 check; refusing to package it." >&2; rm -f "${tgz}"; return 1; }
  install -d -m 0755 "${stage}/opt/vpsgui/node/bin"
  tar -xJf "${tgz}" -C "${stage}/opt/vpsgui/node/bin" --strip-components=2 "node-v${NODE_VERSION}-linux-${NODE_ARCH}/bin/node"
  tar -xJf "${tgz}" -C "${stage}/opt/vpsgui/node" --strip-components=1 "node-v${NODE_VERSION}-linux-${NODE_ARCH}/LICENSE"
  chmod 0755 "${stage}/opt/vpsgui/node/bin/node"
  [ -s "${stage}/opt/vpsgui/node/bin/node" ] || { echo "Error: bundled node binary is empty." >&2; return 1; }
}

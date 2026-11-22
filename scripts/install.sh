#!/bin/sh
#
# VPSGUI installer for Linux distributions that have neither apt nor rpm (and a fallback for those
# that do). POSIX sh.
#
#   curl -fsSLO https://github.com/NotGamerPratham/vpsgui/releases/latest/download/install.sh
#   less install.sh && sudo sh install.sh
#
# Read it before running it as root: piping a remote script straight into `sudo sh` executes
# whatever the URL returns at that moment, with no chance to inspect it.
#
# Options:
#   --version X.Y.Z   install that release instead of the latest
#   --tarball FILE    install from a local archive (offline / pre-downloaded); skips the download
#   --no-deps         do not install nginx/openssl/curl; fail if they are missing
#   --uninstall       stop the agent, unlink the site and delete the program files (keeps data)
#   --purge           with --uninstall, also delete the token, accounts and secrets (never backups)
#
# Environment: VPSGUI_BASE_URL overrides where the archive and SHA256SUMS are fetched from (a
# mirror, or an air-gapped host); it must then be paired with --version.
#
# What it does: checks the host can run the bundled Node.js 22 (systemd, glibc >= 2.28, a supported
# CPU), installs nginx/openssl/curl with the distro's package manager if they are missing,
# downloads the matching archive, verifies its SHA-256 against the release's SHA256SUMS, unpacks it
# over / and runs /opt/vpsgui/bin/vpsgui-setup, the same configuration step the .rpm uses.
#
# The checksum comes from the same release as the archive, so it proves the download is intact, not
# that the release is authentic. To verify authenticity, install through the signed apt/yum
# repositories instead.

set -eu

REPO="NotGamerPratham/vpsgui"
VERSION=""
TARBALL=""
DEPS=1
UNINSTALL=0
PURGE=0

die() { printf 'vpsgui-install: error: %s\n' "$*" >&2; exit 1; }
say() { printf 'vpsgui-install: %s\n' "$*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --version)   [ $# -ge 2 ] || die "--version needs a value"; VERSION="${2#v}"; shift 2 ;;
    --tarball)   [ $# -ge 2 ] || die "--tarball needs a value"; TARBALL="$2"; shift 2 ;;
    --no-deps)   DEPS=0; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    --purge)     PURGE=1; shift ;;
    -h|--help)   sed -n '2,/^set -eu/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

[ "$(id -u)" -eq 0 ] || die "run as root (prefix with sudo)."
[ "$(uname -s)" = Linux ] || die "Linux only."

# --- uninstall -------------------------------------------------------------------------------
if [ "${UNINSTALL}" = 1 ]; then
  if [ -x /opt/vpsgui/bin/vpsgui-setup ]; then /opt/vpsgui/bin/vpsgui-setup remove || true; fi
  rm -f /etc/systemd/system/vpsgui-agent.service
  rm -rf /opt/vpsgui/node /opt/vpsgui/bin /opt/vpsgui/VERSION /opt/vpsgui/agent/server.js \
         /opt/vpsgui/agent/server.cjs /opt/vpsgui/agent/package.json \
         /var/www/vpsgui /usr/share/vpsgui /usr/share/doc/vpsgui
  if [ -d /run/systemd/system ]; then systemctl daemon-reload >/dev/null 2>&1 || true; fi
  if [ "${PURGE}" = 1 ]; then
    rm -rf /opt/vpsgui /etc/nginx/sites-available/vpsgui /etc/nginx/conf.d/vpsgui.conf.disabled
    say "purged. /var/backups/vpsgui was left alone."
  else
    say "removed. Token and accounts are kept in /opt/vpsgui/agent; add --purge to delete them."
  fi
  exit 0
fi

# --- host checks -----------------------------------------------------------------------------
case "$(uname -m)" in
  x86_64|amd64)  NODE_ARCH=x64 ;;
  aarch64|arm64) NODE_ARCH=arm64 ;;
  armv7*)        NODE_ARCH=armv7l ;;
  *) die "unsupported CPU '$(uname -m)'. Supported: x86_64, aarch64, armv7l." ;;
esac

[ -d /run/systemd/system ] || die "systemd is not running. VPSGUI's agent is installed as a systemd service."

# The bundled Node.js is linked against glibc. musl distros (Alpine, Void-musl) cannot run it.
if command -v ldd >/dev/null 2>&1 && ldd --version 2>&1 | grep -qi musl; then
  die "this distribution uses musl libc (e.g. Alpine). The bundled Node.js needs glibc >= 2.28."
fi
GLIBC="$(getconf GNU_LIBC_VERSION 2>/dev/null | awk '{print $2}')"
[ -n "${GLIBC}" ] || die "could not determine the glibc version; the bundled Node.js needs glibc >= 2.28."
GL_MAJ="${GLIBC%%.*}"; GL_MIN="${GLIBC#*.}"; GL_MIN="${GL_MIN%%.*}"
if [ "${GL_MAJ}" -lt 2 ] || { [ "${GL_MAJ}" -eq 2 ] && [ "${GL_MIN}" -lt 28 ]; }; then
  die "glibc ${GLIBC} is too old; the bundled Node.js needs >= 2.28 (Debian 10, RHEL/CentOS 8, Ubuntu 20.04 or newer)."
fi

# --- dependencies ----------------------------------------------------------------------------
need_pkgs=""
command -v nginx   >/dev/null 2>&1 || need_pkgs="${need_pkgs} nginx"
command -v openssl >/dev/null 2>&1 || need_pkgs="${need_pkgs} openssl"
if [ -z "${TARBALL}" ]; then command -v curl >/dev/null 2>&1 || need_pkgs="${need_pkgs} curl"; fi

if [ -n "${need_pkgs}" ]; then
  [ "${DEPS}" = 1 ] || die "missing:${need_pkgs} (and --no-deps was given)."
  say "installing${need_pkgs} ..."
  if   command -v apt-get >/dev/null 2>&1; then DEBIAN_FRONTEND=noninteractive apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y ${need_pkgs}
  elif command -v dnf     >/dev/null 2>&1; then dnf install -y ${need_pkgs}
  elif command -v yum     >/dev/null 2>&1; then yum install -y ${need_pkgs}
  elif command -v zypper  >/dev/null 2>&1; then zypper --non-interactive install ${need_pkgs}
  elif command -v pacman  >/dev/null 2>&1; then pacman -Sy --noconfirm ${need_pkgs}
  else die "no known package manager (apt, dnf, yum, zypper, pacman). Install${need_pkgs} yourself and re-run."
  fi
fi

# --- fetch -----------------------------------------------------------------------------------
WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

if [ -z "${TARBALL}" ]; then
  if [ -n "${VPSGUI_BASE_URL:-}" ] && [ -z "${VERSION}" ]; then
    die "VPSGUI_BASE_URL is set, so --version X.Y.Z is required."
  fi
  if [ -z "${VERSION}" ]; then
    # /releases/latest redirects to /releases/tag/vX.Y.Z; read the tag from the redirect target.
    VERSION="$(curl -fsSIL -o /dev/null -w '%{url_effective}' "https://github.com/${REPO}/releases/latest" | sed -n 's#.*/tag/v\{0,1\}##p')"
    [ -n "${VERSION}" ] || die "could not work out the latest release. Pass --version X.Y.Z."
  fi
  FILE="vpsgui-${VERSION}-linux-${NODE_ARCH}.tar.gz"
  BASE="${VPSGUI_BASE_URL:-https://github.com/${REPO}/releases/download/v${VERSION}}"
  say "downloading ${FILE} ..."
  curl -fSL --retry 3 -o "${WORK}/${FILE}" "${BASE}/${FILE}" || die "download failed: ${BASE}/${FILE}"
  curl -fsSL --retry 3 -o "${WORK}/SHA256SUMS" "${BASE}/SHA256SUMS" || die "could not fetch ${BASE}/SHA256SUMS"
  WANT="$(awk -v f="${FILE}" '$2 == f || $2 == "*" f {print $1}' "${WORK}/SHA256SUMS")"
  [ -n "${WANT}" ] || die "${FILE} is not listed in SHA256SUMS."
  GOT="$(sha256sum "${WORK}/${FILE}" | awk '{print $1}')"
  [ "${WANT}" = "${GOT}" ] || die "checksum mismatch for ${FILE} (expected ${WANT}, got ${GOT}); not installing."
  say "checksum OK."
  TARBALL="${WORK}/${FILE}"
fi
[ -f "${TARBALL}" ] || die "no such file: ${TARBALL}"
case "$(basename "${TARBALL}")" in
  *"-${NODE_ARCH}.tar.gz") ;;
  *) die "$(basename "${TARBALL}") is not built for this CPU (${NODE_ARCH})." ;;
esac

# --- install ---------------------------------------------------------------------------------
# Refuse to overwrite an apt/rpm-managed install: two owners of /opt/vpsgui is how files get lost.
if command -v dpkg >/dev/null 2>&1 && dpkg -s vpsgui >/dev/null 2>&1; then
  die "vpsgui is already installed as a .deb. Use apt to upgrade, or 'apt remove vpsgui' first."
fi
if command -v rpm >/dev/null 2>&1 && rpm -q vpsgui >/dev/null 2>&1; then
  die "vpsgui is already installed as an .rpm. Use dnf/yum to upgrade, or remove it first."
fi

# Refuse an archive that tries to write outside the install paths, whoever built it.
if tar -tzf "${TARBALL}" | grep -E '(^|/)\.\.(/|$)|^/' >/dev/null; then
  die "the archive contains unsafe paths; not installing."
fi

# Stop the agent before replacing the binary it is running.
systemctl stop vpsgui-agent >/dev/null 2>&1 || true

say "unpacking ..."
# --no-overwrite-dir: keep the mode and owner of directories that already exist (/, /usr, /etc,
# /var ...). Without it tar applies the archive's directory entries to the live system, which once
# turned / into 0700 and locked every non-root process out of the filesystem.
tar -xzf "${TARBALL}" -C / --no-same-owner --no-overwrite-dir
chmod 0755 /opt/vpsgui/bin/vpsgui-setup /opt/vpsgui/node/bin/node
# A glibc that clears the floor is necessary but not proof; run the binary once.
/opt/vpsgui/node/bin/node -e 'process.exit(0)' >/dev/null 2>&1 \
  || die "the bundled Node.js does not run on this host (check libstdc++: GLIBCXX 3.4.21, or 3.4.26 on armv7l)."

/opt/vpsgui/bin/vpsgui-setup configure
say "done."

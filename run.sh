#!/usr/bin/env bash
#
# VPSGUI setup & production deployment for a Linux VPS.
# Repository: https://github.com/NotGamerPratham/vpsgui

set -euo pipefail

WEB_ROOT="/var/www/vpsgui/dist"
NGINX_SITE="/etc/nginx/sites-available/vpsgui"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[VPSGUI] Starting setup & production deployment..."

if [ "$(id -u)" -ne 0 ]; then
  echo "[VPSGUI] Error: run as root (sudo ./run.sh) — this installs a systemd service and writes to /var/www." >&2
  exit 1
fi

# 1. Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "[VPSGUI] Node.js not found. Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "[VPSGUI] Node version: $(node -v)"
echo "[VPSGUI] npm version:  $(npm -v)"

# 2. Dependencies
echo "[VPSGUI] Installing workspace dependencies..."
cd "${SCRIPT_DIR}"
# `npm ci` gives a reproducible tree from package-lock.json; fall back if the lockfile is stale.
npm ci || npm install

# 3. Build
echo "[VPSGUI] Building production web assets..."
npm run build

# 4. Publish the build.
#
# When the repository is itself checked out at /var/www/vpsgui, the build output and the web root are
# the SAME directory. The `rm -rf` then deleted the assets that had just been built and the copy
# found an empty source — leaving nginx serving a web root with no JS or CSS at all.
echo "[VPSGUI] Publishing build to ${WEB_ROOT}..."
mkdir -p "${WEB_ROOT}"

SRC_DIST="${SCRIPT_DIR}/dist"
if [ "$(readlink -f "${SRC_DIST}")" = "$(readlink -f "${WEB_ROOT}")" ]; then
  echo "[VPSGUI] Build output already lives at ${WEB_ROOT}; nothing to copy."
else
  rm -rf "${WEB_ROOT:?}/"*
  cp -r "${SRC_DIST}/." "${WEB_ROOT}/"
fi

# Publishing is pointless if the bundle is not actually there.
if ! ls "${WEB_ROOT}"/index.html >/dev/null 2>&1; then
  echo "[VPSGUI] Error: ${WEB_ROOT} has no index.html after publishing." >&2
  exit 1
fi
if ! ls "${WEB_ROOT}"/assets/*.js >/dev/null 2>&1; then
  echo "[VPSGUI] Error: ${WEB_ROOT}/assets contains no JavaScript bundle." >&2
  exit 1
fi

# nginx serves as an unprivileged user (www-data/nginx), not as root. Everything it must read needs
# world-read, and every directory on the path needs world-execute to be traversable — otherwise
# nginx answers 403 Forbidden for the site root with no clue why.
# `a+rX` sets execute on directories only, never on regular files.
echo "[VPSGUI] Granting the nginx worker read access to ${WEB_ROOT}..."
chmod -R a+rX "${WEB_ROOT}"

# Walk up from the web root and make each ancestor traversable. A repository cloned as root into
# /var/www with a restrictive umask leaves these at 0750, which blocks nginx before it ever reaches
# the files.
ancestor="$(dirname "${WEB_ROOT}")"
while [ "${ancestor}" != "/" ] && [ -n "${ancestor}" ]; do
  chmod a+x "${ancestor}" 2>/dev/null || true
  ancestor="$(dirname "${ancestor}")"
done

# 5. Agent (listens on 127.0.0.1:46509)
#
# Runs BEFORE the frontend is considered done. If the agent install fails, the deployment must fail
# loudly rather than leaving a freshly built UI talking to a stale daemon — the symptom of that is
# new pages calling endpoints the old agent does not have, which looks like a frontend bug.
echo "[VPSGUI] Installing the VPSGUI telemetry agent..."
if ! bash "${SCRIPT_DIR}/agent/install.sh"; then
  echo "" >&2
  echo "[VPSGUI] AGENT INSTALL FAILED — the web assets were published but the agent was NOT updated." >&2
  echo "[VPSGUI] The UI will call endpoints the running agent does not implement (404) and writes" >&2
  echo "[VPSGUI] may be rejected (403). Resolve the above error and re-run before using this deploy." >&2
  exit 1
fi

# 6. nginx
if command -v nginx >/dev/null 2>&1; then
  echo "[VPSGUI] Configuring nginx..."
  cp "${SCRIPT_DIR}/deploy/nginx.conf" "${NGINX_SITE}"
  mkdir -p /etc/nginx/sites-enabled
  ln -sf "${NGINX_SITE}" /etc/nginx/sites-enabled/vpsgui
  # The stock Debian default site is also `default_server` on :80 and would collide.
  rm -f /etc/nginx/sites-enabled/default

  if nginx -t; then
    systemctl reload nginx
    echo "[VPSGUI] nginx reloaded."
  else
    echo "[VPSGUI] Error: nginx config test failed; leaving the running config untouched." >&2
    exit 1
  fi
else
  echo "[VPSGUI] nginx is not installed. Install it and copy deploy/nginx.conf into place manually."
fi

echo ""
echo "[VPSGUI] Deployment complete. The UI is served on port 80."
echo "[VPSGUI] Paste the agent token printed above into Settings -> Agent Token."
echo ""
echo "[VPSGUI] IMPORTANT: enable HTTPS before using this over any untrusted network."
echo "[VPSGUI] The agent token is sent as a bearer header and grants root-equivalent host control."
echo "[VPSGUI]   certbot --nginx -d your-domain.example"

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
  echo "[VPSGUI] Error: run as root (sudo ./run.sh) — this installs a service and writes to /var/www." >&2
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
# The agent install must actually run and must actually succeed. Previously the publish step above
# could abort under `set -e`, so this never executed and the deploy silently left a freshly built UI
# talking to a stale daemon — which shows up as new pages 404ing on endpoints the old agent lacks.
#
# AGENT_PROCESS_MANAGER selects the supervisor. install.sh installs pm2 (via npm — pm2 is not an apt
# package) when missing, and tears the other supervisor down first so they cannot race for the port.
AGENT_PROCESS_MANAGER="${AGENT_PROCESS_MANAGER:-pm2}"
export AGENT_PROCESS_MANAGER

echo "[VPSGUI] Installing the VPSGUI telemetry agent (supervisor: ${AGENT_PROCESS_MANAGER})..."
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
  NGINX_LINK="/etc/nginx/sites-enabled/vpsgui"
  NGINX_BACKUP=""
  mkdir -p /etc/nginx/sites-enabled

  # Record enough state to undo everything if the config test fails. The symlink is created before
  # `nginx -t` can run, so without a rollback a bad config stays enabled and nginx fails to start on
  # its next restart — taking every other site on the box down with it.
  LINK_EXISTED=0
  [ -L "${NGINX_LINK}" ] && LINK_EXISTED=1
  if [ -f "${NGINX_SITE}" ]; then
    NGINX_BACKUP="${NGINX_SITE}.bak.$$"
    cp "${NGINX_SITE}" "${NGINX_BACKUP}"
  fi

  cp "${SCRIPT_DIR}/deploy/nginx.conf" "${NGINX_SITE}"

  # Only one vhost may be `default_server` per address:port; nginx rejects a duplicate outright.
  # On a box already hosting other sites, claiming it breaks the entire nginx config, so detect an
  # existing owner and drop the flag from OUR copy instead of failing the deploy.
  OTHER_DEFAULT="$(grep -rlE '^[[:space:]]*listen[^;]*[[:space:]]default_server' \
      /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null \
      | grep -v -e '/vpsgui$' -e '/default$' || true)"

  if [ -n "${OTHER_DEFAULT}" ]; then
    echo "[VPSGUI] Another site already claims default_server on :80:"
    echo "${OTHER_DEFAULT}" | sed 's/^/[VPSGUI]   /'
    echo "[VPSGUI] Dropping default_server from the VPSGUI vhost to avoid a duplicate."
    sed -i 's/\(^[[:space:]]*listen[^;]*\)[[:space:]]default_server;/\1;/' "${NGINX_SITE}"

    if [ -n "${VPSGUI_SERVER_NAME:-}" ]; then
      sed -i "s/^\([[:space:]]*\)server_name .*/\1server_name ${VPSGUI_SERVER_NAME};/" "${NGINX_SITE}"
      echo "[VPSGUI] VPSGUI vhost bound to server_name ${VPSGUI_SERVER_NAME}."
    else
      echo "[VPSGUI] WARNING: without default_server this vhost only answers requests whose Host"
      echo "[VPSGUI] header matches its server_name, so the site may be unreachable. Re-run as:"
      echo "[VPSGUI]   sudo VPSGUI_SERVER_NAME=your-domain-or-ip ./run.sh"
    fi
  else
    # Only claim default_server when nothing else does. The stock Debian site is also a
    # default_server on :80 and would collide.
    rm -f /etc/nginx/sites-enabled/default
  fi

  ln -sf "${NGINX_SITE}" "${NGINX_LINK}"

  if nginx -t; then
    systemctl reload nginx
    echo "[VPSGUI] nginx reloaded."
    [ -n "${NGINX_BACKUP}" ] && rm -f "${NGINX_BACKUP}"
  else
    echo "[VPSGUI] Error: nginx config test failed; rolling back the VPSGUI vhost." >&2
    if [ "${LINK_EXISTED}" -eq 0 ]; then
      rm -f "${NGINX_LINK}"
    fi
    if [ -n "${NGINX_BACKUP}" ]; then
      mv "${NGINX_BACKUP}" "${NGINX_SITE}"
    fi
    if nginx -t >/dev/null 2>&1; then
      echo "[VPSGUI] Rolled back — the previous nginx config is valid again and nginx will still start." >&2
    else
      echo "[VPSGUI] WARNING: nginx config is STILL invalid after rollback. Run 'nginx -t' and fix it" >&2
      echo "[VPSGUI] before nginx is restarted, or it will fail to start." >&2
    fi
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

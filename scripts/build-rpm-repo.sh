#!/usr/bin/env bash
#
# Turn a directory of .rpm files into a signed yum/dnf repository.
#
#   scripts/build-rpm-repo.sh <rpms-dir> <repo-dir>
#
# Signing uses the GPG key named by APT_GPG_KEY_ID (the same key the apt repository uses, so there
# is one trust anchor to publish), which must already be in the keyring. Every package is signed,
# and so is the repository metadata, so clients can run with gpgcheck=1 AND repo_gpgcheck=1. With
# no key set the repository is still generated but UNSIGNED - useful for a local test, never to
# be published.
#
# RPM_BASE_URL sets the baseurl written into vpsgui.repo (default: the GitHub Pages location; a
# local test points it at file://).
#
# Layout:
#   <repo>/<arch>/Packages/*.rpm
#   <repo>/<arch>/repodata/{repomd.xml,repomd.xml.asc,...}      arch: x86_64, aarch64
#   <repo>/vpsgui.repo                                          drop-in for /etc/yum.repos.d/
#   <repo>/key.gpg                                              armored public key

set -euo pipefail

RPMS="${1:?usage: build-rpm-repo.sh <rpms-dir> <repo-dir>}"
REPO="${2:?usage: build-rpm-repo.sh <rpms-dir> <repo-dir>}"
BASE_URL="${RPM_BASE_URL:-https://notgamerpratham.github.io/vpsgui/rpm}"
KEY_URL="${RPM_KEY_URL:-https://notgamerpratham.github.io/vpsgui/key.gpg}"
ARCHES="x86_64 aarch64"

for tool in createrepo_c rpmsign gpg; do
  command -v "${tool}" >/dev/null 2>&1 || {
    echo "Error: ${tool} not found (apt install createrepo-c rpm gnupg / dnf install createrepo_c rpm-sign gnupg2)." >&2
    exit 1
  }
done
ls "${RPMS}"/*.rpm >/dev/null 2>&1 || { echo "Error: no .rpm files in ${RPMS}" >&2; exit 1; }

SIGN=0
PASSFILE=""
if [ -n "${APT_GPG_KEY_ID:-}" ]; then
  SIGN=1
  if [ -n "${APT_GPG_PASSPHRASE:-}" ]; then
    PASSFILE="$(mktemp)"; chmod 600 "${PASSFILE}"
    printf '%s' "${APT_GPG_PASSPHRASE}" > "${PASSFILE}"
    trap 'rm -f "${PASSFILE}"' EXIT
  fi
fi

GPG_BASE=(gpg --batch --yes --pinentry-mode loopback --local-user "${APT_GPG_KEY_ID:-}")
[ -n "${PASSFILE}" ] && GPG_BASE+=(--passphrase-file "${PASSFILE}")

for arch in ${ARCHES}; do
  DIR="${REPO}/${arch}"
  mkdir -p "${DIR}/Packages"
  # noarch would belong in every directory; this package is always arch-specific (bundled Node.js).
  for f in "${RPMS}"/*."${arch}".rpm; do [ -e "$f" ] && cp "$f" "${DIR}/Packages/"; done

  if [ "${SIGN}" = 1 ]; then
    for f in "${DIR}"/Packages/*.rpm; do
      [ -e "$f" ] || continue
      # Extend rpm's own sign command rather than replacing it: it differs between rpm versions.
      rpmsign --define "_gpg_name ${APT_GPG_KEY_ID}" \
              --define "_gpg_sign_cmd_extra_args --batch --pinentry-mode loopback ${PASSFILE:+--passphrase-file ${PASSFILE}}" \
              --addsign "$f" >/dev/null
    done
  fi

  # gzip metadata: createrepo_c's newer zstd default is unreadable by the dnf/libsolv on RHEL 8.
  createrepo_c --general-compress-type gz --quiet "${DIR}"
  if [ "${SIGN}" = 1 ]; then
    "${GPG_BASE[@]}" --armor --detach-sign --output "${DIR}/repodata/repomd.xml.asc" "${DIR}/repodata/repomd.xml"
  fi
done

cat > "${REPO}/vpsgui.repo" <<REPOFILE
[vpsgui]
name=VPSGUI
baseurl=${BASE_URL}/\$basearch
enabled=1
gpgcheck=$([ "${SIGN}" = 1 ] && echo 1 || echo 0)
repo_gpgcheck=$([ "${SIGN}" = 1 ] && echo 1 || echo 0)
gpgkey=${KEY_URL}
REPOFILE

if [ "${SIGN}" = 1 ]; then
  gpg --batch --yes --armor --export "${APT_GPG_KEY_ID}" > "${REPO}/key.gpg"
  echo "Signed repository written to ${REPO}"
else
  echo "WARNING: APT_GPG_KEY_ID is not set - the repository at ${REPO} is UNSIGNED." >&2
fi

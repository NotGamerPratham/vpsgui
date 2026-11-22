#!/usr/bin/env bash
#
# Turn a directory of .deb files into a signed apt repository.
#
#   scripts/build-apt-repo.sh <debs-dir> <repo-dir>
#
# Signing uses the GPG key named by APT_GPG_KEY_ID, which must already be in the keyring. With no
# key set the repository is still generated but UNSIGNED - useful for a local test, never to be
# published: apt refuses an unsigned repository unless told to trust it, and telling people to do
# that is how they learn to ignore the warning.
#
# Layout (flat, single suite/component, so the client line is just `... stable main`):
#   <repo>/dists/stable/main/binary-{amd64,arm64,armhf}/Packages{,.gz}
#   <repo>/dists/stable/{Release,Release.gpg,InRelease}
#   <repo>/pool/main/*.deb
#   <repo>/key.gpg                      armored public key, for `gpg --dearmor`

set -euo pipefail

DEBS="${1:?usage: build-apt-repo.sh <debs-dir> <repo-dir>}"
REPO="${2:?usage: build-apt-repo.sh <debs-dir> <repo-dir>}"
SUITE=stable
COMPONENT=main

for tool in dpkg-scanpackages apt-ftparchive gzip; do
  command -v "${tool}" >/dev/null 2>&1 || {
    echo "Error: ${tool} not found (apt install dpkg-dev apt-utils)." >&2
    exit 1
  }
done

ls "${DEBS}"/*.deb >/dev/null 2>&1 || { echo "Error: no .deb files in ${DEBS}" >&2; exit 1; }

ARCHES="amd64 arm64 armhf"
POOL="${REPO}/pool/${COMPONENT}"
mkdir -p "${POOL}"
cp "${DEBS}"/*.deb "${POOL}/"

# One index per architecture: the package bundles a native Node.js binary, so a single "all" index
# would hand an arm64 server the amd64 build. An arch with no .deb yet still gets an (empty) index,
# because apt treats a missing one as a hard error rather than "nothing to install".
for arch in ${ARCHES}; do
  BIN="${REPO}/dists/${SUITE}/${COMPONENT}/binary-${arch}"
  mkdir -p "${BIN}"
  # Paths in Packages must be relative to the repo root, so scan from there.
  ( cd "${REPO}" && dpkg-scanpackages --multiversion --arch "${arch}" "pool/${COMPONENT}" /dev/null > "dists/${SUITE}/${COMPONENT}/binary-${arch}/Packages" )
  gzip -9 -k -f "${BIN}/Packages"
done

(
  cd "${REPO}/dists/${SUITE}"
  apt-ftparchive \
    -o "APT::FTPArchive::Release::Origin=VPSGUI" \
    -o "APT::FTPArchive::Release::Label=VPSGUI" \
    -o "APT::FTPArchive::Release::Suite=${SUITE}" \
    -o "APT::FTPArchive::Release::Codename=${SUITE}" \
    -o "APT::FTPArchive::Release::Architectures=${ARCHES}" \
    -o "APT::FTPArchive::Release::Components=${COMPONENT}" \
    release . > Release
)

if [ -n "${APT_GPG_KEY_ID:-}" ]; then
  GPG_ARGS=(--batch --yes --pinentry-mode loopback --local-user "${APT_GPG_KEY_ID}")
  [ -n "${APT_GPG_PASSPHRASE:-}" ] && GPG_ARGS+=(--passphrase "${APT_GPG_PASSPHRASE}")

  gpg "${GPG_ARGS[@]}" --armor --detach-sign --output "${REPO}/dists/${SUITE}/Release.gpg" "${REPO}/dists/${SUITE}/Release"
  gpg "${GPG_ARGS[@]}" --clearsign --output "${REPO}/dists/${SUITE}/InRelease" "${REPO}/dists/${SUITE}/Release"
  gpg --batch --yes --armor --export "${APT_GPG_KEY_ID}" > "${REPO}/key.gpg"
  echo "Signed repository written to ${REPO}"
else
  echo "WARNING: APT_GPG_KEY_ID is not set - the repository at ${REPO} is UNSIGNED." >&2
fi

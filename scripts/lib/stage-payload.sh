# Sourced by build-rpm.sh and build-tarball.sh - not executable on its own.
#
# Stages the architecture-independent part of the payload under <stage>, at the paths it is
# installed to. (build-deb.sh predates this and does the same inline; the Node.js part is shared
# through node-bundle.sh.) Run from the repo root.

# stage_payload <stage>
stage_payload() {
  local stage="$1"
  install -d -m 0755 "${stage}/opt/vpsgui/agent" "${stage}/opt/vpsgui/bin"
  install -m 0644 agent/server.js    "${stage}/opt/vpsgui/agent/server.js"
  install -m 0644 agent/server.cjs   "${stage}/opt/vpsgui/agent/server.cjs"
  install -m 0644 agent/package.json "${stage}/opt/vpsgui/agent/package.json"
  install -m 0755 packaging/common/vpsgui-setup "${stage}/opt/vpsgui/bin/vpsgui-setup"

  install -d -m 0755 "${stage}/var/www/vpsgui"
  cp -r dist "${stage}/var/www/vpsgui/dist"
  # a+rX: nginx runs as www-data / nginx and needs to read every file and traverse every directory.
  chmod -R a+rX,u+w,go-w "${stage}/var/www/vpsgui"

  install -d -m 0755 "${stage}/usr/share/vpsgui"
  install -m 0644 deploy/nginx.conf "${stage}/usr/share/vpsgui/nginx.conf"
}

# Spec for the vpsgui RPM. Not built directly: scripts/build-rpm.sh stages the payload (the same
# tree the .deb ships) and passes it in with --define, so the two formats cannot disagree about
# what is installed.
#
#   %{vpsgui_version}  package version (ci builds use e.g. 0.0.0~ci.12)
#   %{vpsgui_stage}    directory holding the staged payload

# Nothing is compiled, and the bundled Node.js is a prebuilt binary - possibly for another
# architecture than the build host. Stripping it, or building debuginfo for it, would fail or
# damage it.
%global debug_package %{nil}
%global __os_install_post %{nil}
%global _build_id_links none
%global _missing_build_ids_terminate_build 0
# Do not advertise the bundled node's libraries as something this package provides.
AutoProv: no

Name:           vpsgui
Version:        %{vpsgui_version}
Release:        1
Summary:        Self-hosted web console for Linux servers and Docker
License:        MIT
URL:            https://github.com/NotGamerPratham/vpsgui
# Dependencies on libc / libstdc++ are generated from the bundled binary's own symbol imports
# (AutoReq), so rpm refuses the install on a host too old to run it instead of letting the agent
# fail to start. nginx and openssl are the only things the postinstall needs from the distro.
Requires:       nginx
Requires:       openssl
Requires:       systemd
Recommends:     curl

%description
VPSGUI is a control plane for a Linux server: live telemetry read from /proc, a host shell,
a file manager, Docker, firewall rules, an encrypted secret store and backups, served by a
zero-dependency Node.js agent behind nginx. Node.js is bundled, so no distribution Node
package is needed.

The agent grants root-equivalent control of the host. It binds to loopback only, and
everything except /health requires its token. Serve the site over TLS before signing in
from anywhere but localhost.

%prep
# nothing to unpack

%build
# nothing to build

%install
mkdir -p %{buildroot}
cp -a %{vpsgui_stage}/. %{buildroot}/

%files
%license /usr/share/licenses/vpsgui/LICENSE
%dir /opt/vpsgui
%dir /opt/vpsgui/agent
/opt/vpsgui/agent/server.js
/opt/vpsgui/agent/server.cjs
/opt/vpsgui/agent/package.json
/opt/vpsgui/bin
/opt/vpsgui/node
/var/www/vpsgui
/usr/share/vpsgui
/usr/lib/systemd/system/vpsgui-agent.service

%post
/opt/vpsgui/bin/vpsgui-setup configure || :

%preun
# $1 is 0 only on a real removal. On upgrade the new package's %post restarts the agent, so
# stopping it here would only add a gap.
if [ "$1" -eq 0 ]; then
    /opt/vpsgui/bin/vpsgui-setup remove || :
fi

%changelog
* Mon Nov 02 2026 NotGamerPratham <notgamerpratham@gmail.com> - %{vpsgui_version}-1
- Packaged from the vpsgui source tree.

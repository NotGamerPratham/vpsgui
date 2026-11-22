import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Drift guards for the RPM, the portable tarball/installer and the shared setup script.
 *
 * Three formats (.deb, .rpm, tarball) repeat facts that live elsewhere: the env-file keys, the
 * unit's paths, the glibc floor, the architecture names. The real checks are scripts/smoke-rpm.sh,
 * smoke-deb.sh and smoke-installer.sh, which install on a systemd host; these run anywhere in the
 * normal suite and catch the cheap breakages first.
 */

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf-8');

const SETUP = read('packaging/common/vpsgui-setup');
const POSTINST = read('packaging/debian/postinst');
const UNIT = read('packaging/common/vpsgui-agent.service');
const INSTALL_SH = read('scripts/install.sh');
const AGENT_INSTALL_SH = read('agent/install.sh');
const SPEC = read('packaging/rpm/vpsgui.spec');
const BUILD_RPM = read('scripts/build-rpm.sh');
const BUILD_DEB = read('scripts/build-deb.sh');
const BUILD_TGZ = read('scripts/build-tarball.sh');
const RPM_REPO = read('scripts/build-rpm-repo.sh');
const NODE_LIB = read('scripts/lib/node-bundle.sh');
const STAGE_LIB = read('scripts/lib/stage-payload.sh');
const WORKFLOW = read('.github/workflows/packages.yml');
const DOC = read('docs/LINUX_INSTALLATION.md');
const NGINX = read('deploy/nginx.conf');

const WANTED_KEYS = ['AGENT_ENABLE_SHELL', 'AGENT_FILE_ROOTS', 'AGENT_HOST', 'AGENT_IPINFO_TOKEN', 'AGENT_TOKEN', 'PORT'];

/** KEY= lines at the start of a line, de-duplicated and restricted to the env-file keys. */
function envKeys(script: string): string[] {
  return [...new Set([...script.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]))]
    .filter((k) => WANTED_KEYS.includes(k))
    .sort();
}

describe('shared setup script', () => {
  it('writes the same agent.env keys as the .deb and the existing installer', () => {
    // An operator moving between apt, dnf, the installer and run.sh must find the same settings.
    expect(envKeys(SETUP)).toEqual(WANTED_KEYS);
    expect(envKeys(POSTINST)).toEqual(WANTED_KEYS);
    expect(envKeys(AGENT_INSTALL_SH)).toEqual(WANTED_KEYS);
  });

  it('points at the env file the unit reads and the template every format ships', () => {
    const unitFile = /EnvironmentFile=(\S+)/.exec(UNIT)?.[1];
    expect(/^ENV_FILE="\$\{INSTALL_DIR\}\/([^"]+)"/m.exec(SETUP)?.[1]).toBe('agent.env');
    expect(/^INSTALL_DIR=(\S+)/m.exec(SETUP)?.[1]).toBe('/opt/vpsgui/agent');
    expect(unitFile).toBe('/opt/vpsgui/agent/agent.env');
    expect(/^TEMPLATE=(\S+)/m.exec(SETUP)?.[1]).toBe('/usr/share/vpsgui/nginx.conf');
    expect(STAGE_LIB).toContain('"${stage}/usr/share/vpsgui/nginx.conf"');
  });

  it('keeps the agent loopback-only, mode 0600, and never regenerates the token', () => {
    expect(SETUP).toMatch(/AGENT_HOST=127\.0\.0\.1/);
    expect(SETUP).toMatch(/chmod 600 "\$\{ENV_FILE\}"/);
    expect(SETUP).toMatch(/umask 077/);
    // Generation must sit inside the "file does not exist" branch.
    expect(SETUP).toMatch(/if \[ ! -f "\$\{ENV_FILE\}" \]; then[\s\S]*openssl rand -hex 32/);
  });

  it('proxies to, and verifies, the port the agent defaults to', () => {
    expect(NGINX).toMatch(/proxy_pass http:\/\/127\.0\.0\.1:46509\//);
    expect(SETUP).toMatch(/PORT=46509/);
    expect(SETUP).toContain('http://127.0.0.1:46509/api/v1/agent/info');
  });

  it('cannot fail a scriptlet: no set -e, always exits 0', () => {
    // A failing %post leaves rpm half-installed; problems are reported loudly instead.
    expect(SETUP).not.toMatch(/^set -e/m);
    expect(SETUP.trimEnd().endsWith('exit 0')).toBe(true);
  });

  it('starts nginx, which the RHEL family installs stopped and disabled', () => {
    expect(SETUP).toMatch(/systemctl enable --now nginx/);
  });

  it('handles both nginx layouts and keeps the vhost on remove', () => {
    expect(SETUP).toContain('/etc/nginx/sites-available/vpsgui');
    expect(SETUP).toContain('/etc/nginx/conf.d/vpsgui.conf');
    // Remove disables rather than deletes, so a reinstall picks up where it left off.
    expect(SETUP).toMatch(/mv "\$\{SITE\}" "\$\{SITE\}\.disabled"/);
  });

  it('never touches the backups directory', () => {
    const commands = SETUP.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
    expect(commands).not.toContain('/var/backups');
  });
});

describe('rpm', () => {
  it('requires nginx and openssl, and no Node.js', () => {
    expect(SPEC).toMatch(/^Requires:\s+nginx/m);
    expect(SPEC).toMatch(/^Requires:\s+openssl/m);
    expect(SPEC).not.toMatch(/^Requires:.*node/im);
  });

  it('lets rpm derive the glibc/libstdc++ requirements from the bundled binary', () => {
    // AutoReq must stay on: it is what makes rpm refuse a host too old to run the bundled node.
    expect(SPEC).not.toMatch(/^AutoReq(Prov)?:\s*no/m);
    expect(SPEC).toMatch(/^AutoProv:\s*no/m);
  });

  it('leaves the foreign-architecture binary alone', () => {
    // Stripping or debuginfo on an aarch64 node from an x86 build host would fail or corrupt it.
    expect(SPEC).toMatch(/%global debug_package %\{nil\}/);
    expect(SPEC).toMatch(/%global __os_install_post %\{nil\}/);
  });

  it('configures after install and tears down only on a real removal', () => {
    expect(SPEC).toMatch(/%post\s+\/opt\/vpsgui\/bin\/vpsgui-setup configure/);
    // $1 is 0 only on erase; acting on upgrade would stop the agent the new %post then restarts.
    expect(SPEC).toMatch(/%preun[\s\S]*if \[ "\$1" -eq 0 \]; then[\s\S]*vpsgui-setup remove/);
  });

  it('owns every path the build stages', () => {
    for (const p of [
      '/opt/vpsgui/agent/server.js',
      '/opt/vpsgui/agent/server.cjs',
      '/opt/vpsgui/bin',
      '/opt/vpsgui/node',
      '/var/www/vpsgui',
      '/usr/share/vpsgui',
      '/usr/lib/systemd/system/vpsgui-agent.service',
    ]) {
      expect(SPEC, `%files must list ${p}`).toContain(p);
    }
    expect(BUILD_RPM).toContain('"${STAGE}/usr/lib/systemd/system/vpsgui-agent.service"');
  });

  it('builds a package old rpm can read', () => {
    // RHEL 7/8 rpm cannot read zstd payloads.
    expect(BUILD_RPM).toMatch(/_binary_payload w\d\.xzdio/);
    expect(BUILD_RPM).toMatch(/_rpmformat 4/);
  });

  it('maps each rpm architecture onto a pinned node build', () => {
    expect(BUILD_RPM).toMatch(/x86_64\)\s+DEB_EQ=amd64/);
    expect(BUILD_RPM).toMatch(/aarch64\)\s+DEB_EQ=arm64/);
    expect(BUILD_RPM).toContain('node_pin "${DEB_EQ}"');
    expect(NODE_LIB).toMatch(/amd64\).*NODE_ARCH=x64/);
    expect(NODE_LIB).toMatch(/arm64\).*NODE_ARCH=arm64/);
  });
});

describe('every format ships the same payload', () => {
  it('stages the same agent files as the .deb', () => {
    for (const f of ['server.js', 'server.cjs', 'package.json']) {
      expect(BUILD_DEB).toContain(`agent/${f}`);
      expect(STAGE_LIB).toContain(`agent/${f}`);
    }
    expect(STAGE_LIB).toContain('packaging/common/vpsgui-setup');
  });

  it('uses the one shared unit, running the bundled node', () => {
    expect(/ExecStart=(\S+)/.exec(UNIT)?.[1]).toBe('/opt/vpsgui/node/bin/node');
    for (const script of [BUILD_DEB, BUILD_RPM, BUILD_TGZ]) {
      expect(script).toContain('packaging/common/vpsgui-agent.service');
    }
    expect(existsSync(resolve(__dirname, '..', 'packaging/debian/vpsgui-agent.service'))).toBe(false);
  });

  it('shares one Node.js pin between all three builds', () => {
    for (const script of [BUILD_DEB, BUILD_RPM, BUILD_TGZ]) {
      expect(script).toContain('scripts/lib/node-bundle.sh');
      expect(script).not.toMatch(/NODE_SHA256=[0-9a-f]{64}/);
    }
  });

  it('keeps the glibc floor consistent across the .deb, the installer and the docs', () => {
    expect(BUILD_DEB).toMatch(/libc6 \(>= 2\.28\)/);
    // install.sh compares minor versions: refuse when below 28.
    expect(INSTALL_SH).toMatch(/GL_MIN.*-lt 28/);
    expect(INSTALL_SH).toContain('>= 2.28');
    expect(DOC).toContain('glibc 2.28');
  });
});

describe('portable installer', () => {
  it('verifies the archive against SHA256SUMS before unpacking', () => {
    const verify = INSTALL_SH.indexOf('checksum mismatch');
    const unpack = INSTALL_SH.indexOf('tar -xzf');
    expect(verify).toBeGreaterThan(-1);
    expect(unpack).toBeGreaterThan(verify);
    expect(INSTALL_SH).toContain('SHA256SUMS');
  });

  it('refuses an archive with unsafe paths, and one built for another CPU', () => {
    expect(INSTALL_SH).toMatch(/unsafe paths/);
    expect(INSTALL_SH).toMatch(/not built for this CPU/);
  });

  it('refuses musl and hosts without systemd', () => {
    expect(INSTALL_SH).toMatch(/musl/);
    expect(INSTALL_SH).toContain('/run/systemd/system');
  });

  it('names the archive the way build-tarball.sh does', () => {
    expect(BUILD_TGZ).toContain('vpsgui-${VERSION}-linux-${NODE_ARCH}.tar.gz');
    expect(INSTALL_SH).toContain('vpsgui-${VERSION}-linux-${NODE_ARCH}.tar.gz');
    for (const a of ['x64', 'arm64', 'armv7l']) {
      expect(INSTALL_SH).toContain(`NODE_ARCH=${a}`);
      expect(NODE_LIB).toContain(`NODE_ARCH=${a}`);
    }
  });

  it('cannot change the mode of the filesystem root', () => {
    // Regression: the archive once contained "./" (a mktemp -d, mode 0700) and extracting it as
    // root onto / chmod'd the real root directory to 0700, locking nginx's workers out of the
    // whole filesystem. Both halves of the fix are asserted: no root entry in the archive...
    const tarCmd = /^tar [^\n]*-czf "\$\{TGZ\}"([^\n]*)$/m.exec(BUILD_TGZ)?.[1] ?? '';
    expect(tarCmd.trim()).toBe('etc opt usr var');
    expect(tarCmd).not.toMatch(/(^|\s)\.(\s|$)/);
    // ...and extraction that never applies archive metadata to directories that already exist.
    expect(INSTALL_SH).toMatch(/tar -xzf "\$\{TARBALL\}" -C \/ [^\n]*--no-overwrite-dir/);
  });

  it('does not overwrite a package-managed install', () => {
    expect(INSTALL_SH).toMatch(/dpkg -s vpsgui/);
    expect(INSTALL_SH).toMatch(/rpm -q vpsgui/);
  });

  it('is not advertised as curl | sudo sh', () => {
    // The README tells people to read a script before running it as root; stay consistent.
    expect(INSTALL_SH).not.toMatch(/curl[^\n]*\|\s*sudo/);
    expect(DOC).not.toMatch(/curl[^\n]*\|\s*(sudo\s+)?(ba)?sh/);
  });

  it('deletes the token only on --purge, and never the backups', () => {
    expect(INSTALL_SH).toMatch(/PURGE.* = 1 \]; then\s+rm -rf \/opt\/vpsgui/);
    const commands = INSTALL_SH.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
    expect(commands).not.toMatch(/rm [^\n]*\/var\/backups/);
  });
});

describe('repositories', () => {
  it('builds a yum index for exactly the architectures it can package', () => {
    expect(RPM_REPO).toMatch(/ARCHES="x86_64 aarch64"/);
  });

  it('signs the packages and the metadata, and uses gzip metadata', () => {
    expect(RPM_REPO).toContain('rpmsign');
    expect(RPM_REPO).toContain('repomd.xml.asc');
    // createrepo_c defaults to zstd, which the dnf on RHEL 8 cannot read.
    expect(RPM_REPO).toMatch(/--general-compress-type gz/);
    expect(RPM_REPO).toMatch(/repo_gpgcheck=\$/);
  });

  it('publishes one key at the URL the docs tell people to fetch', () => {
    // The apt script writes <repo>/key.gpg and the repo is published under apt/, so without this
    // copy the key would only exist at /apt/key.gpg and the documented URL would 404.
    expect(WORKFLOW).toMatch(/cp site\/apt\/key\.gpg site\/key\.gpg/);
    expect(DOC).toContain('https://notgamerpratham.github.io/vpsgui/key.gpg');
    expect(RPM_REPO).toContain('https://notgamerpratham.github.io/vpsgui/key.gpg');
    expect(WORKFLOW).toMatch(/cp site\/rpm\/vpsgui\.repo site\/vpsgui\.repo/);
    expect(DOC).toContain('https://notgamerpratham.github.io/vpsgui/vpsgui.repo');
  });
});

describe('release workflow', () => {
  it('builds every format and architecture', () => {
    for (const arch of ['amd64', 'arm64', 'armhf']) expect(WORKFLOW).toContain(arch);
    for (const arch of ['x86_64', 'aarch64']) expect(WORKFLOW).toContain(arch);
    for (const script of ['build-deb.sh', 'build-rpm.sh', 'build-tarball.sh']) {
      expect(WORKFLOW).toContain(`scripts/${script}`);
    }
  });

  it('installs no Node.js on the runner, so a missing system Node is what gets tested', () => {
    expect(WORKFLOW).not.toMatch(/apt-get install[^\n]*nodejs/);
  });

  it('smoke-tests the .deb and the installer, and attaches checksums and install.sh', () => {
    expect(WORKFLOW).toContain('scripts/smoke-deb.sh');
    expect(WORKFLOW).toContain('scripts/smoke-installer.sh');
    expect(WORKFLOW).toContain('SHA256SUMS');
    expect(WORKFLOW).toContain('scripts/install.sh');
    expect(WORKFLOW).toMatch(/_amd64\.deb/);
  });

  it('checks the repo out before running scripts from it', () => {
    // The repository job calls scripts/build-*-repo.sh; without a checkout of the default branch
    // they do not exist on the runner.
    const job = WORKFLOW.slice(WORKFLOW.indexOf('  repos:'));
    const firstCheckout = job.indexOf('actions/checkout@v4');
    const firstScript = job.indexOf('scripts/build-apt-repo.sh');
    expect(firstCheckout).toBeGreaterThan(-1);
    expect(firstCheckout).toBeLessThan(firstScript);
  });
});

describe('line endings', () => {
  it('keeps every shipped script and the spec free of CRLF', () => {
    // A CR after the shebang makes the kernel look for an interpreter named "sh\r"; in a spec it
    // corrupts macros. Windows checkouts can introduce them.
    for (const f of [
      'packaging/common/vpsgui-setup',
      'packaging/common/vpsgui-agent.service',
      'packaging/rpm/vpsgui.spec',
      'scripts/install.sh',
      'scripts/build-rpm.sh',
      'scripts/build-tarball.sh',
      'scripts/build-rpm-repo.sh',
      'scripts/lib/node-bundle.sh',
      'scripts/lib/stage-payload.sh',
      'scripts/smoke-rpm.sh',
      'scripts/smoke-installer.sh',
    ]) {
      expect(read(f), `${f} has CRLF line endings`).not.toContain('\r');
    }
  });
});

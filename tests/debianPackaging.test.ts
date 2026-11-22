import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Drift guards for the Debian package.
 *
 * The package duplicates facts that live elsewhere - the env file path and keys that install.sh
 * writes, the entry point the unit executes, the port nginx proxies to - and every one of those has
 * drifted before. The real check is scripts/smoke-deb.sh, which installs the .deb on a systemd
 * host; these run anywhere, in the normal test suite, and catch the cheap breakages first.
 */

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf-8');

const POSTINST = read('packaging/debian/postinst');
const UNIT = read('packaging/common/vpsgui-agent.service');
const INSTALL_SH = read('agent/install.sh');
const BUILD = read('scripts/build-deb.sh');
// The pinned Node.js and its download/verify step are shared by the .deb, .rpm and tarball builds.
const NODE_LIB = read('scripts/lib/node-bundle.sh');
const NGINX = read('deploy/nginx.conf');

/** KEY= lines written into the env file by a script. */
function envKeys(script: string): string[] {
  // A Set: install.sh assigns AGENT_TOKEN on several lines while locating an existing token.
  return [...new Set([...script.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]))].sort();
}

describe('debian packaging', () => {
  it('writes the same agent.env keys as the existing installer', () => {
    // An operator moving between `run.sh` and `apt` must find the same settings in the same file.
    // PORT/AGENT_HOST/AGENT_TOKEN/... only; install.sh also has shell assignments with other names.
    const wanted = ['AGENT_ENABLE_SHELL', 'AGENT_FILE_ROOTS', 'AGENT_HOST', 'AGENT_IPINFO_TOKEN', 'AGENT_TOKEN', 'PORT'];
    const fromPostinst = envKeys(POSTINST).filter((k) => wanted.includes(k));
    const fromInstaller = envKeys(INSTALL_SH).filter((k) => wanted.includes(k));
    expect(fromPostinst).toEqual(wanted);
    expect(fromInstaller).toEqual(wanted);
  });

  it('points the unit at the same env file the postinst writes', () => {
    const unitFile = /EnvironmentFile=(\S+)/.exec(UNIT)?.[1];
    const postinstFile = /ENV_FILE="\$\{INSTALL_DIR\}\/([^"]+)"/.exec(POSTINST)?.[1];
    const installDir = /INSTALL_DIR=(\S+)/.exec(POSTINST)?.[1];
    expect(unitFile).toBe(`${installDir}/${postinstFile}`);
  });

  it('executes an entry point the package actually ships', () => {
    const entry = /ExecStart=\S+\s+(\S+)/.exec(UNIT)?.[1] ?? '';
    const shipped = /install -m 0644 agent\/(\S+)\s+"\$\{STAGE\}(\/opt\/vpsgui\/agent\/\S+?)"/g;
    const paths = [...BUILD.matchAll(shipped)].map((m) => m[2]);
    expect(paths).toContain(entry);
    expect(existsSync(resolve(__dirname, '..', 'agent', entry.split('/').pop()!))).toBe(true);
  });

  it('keeps the agent loopback-only and mode 0600 on the token file', () => {
    expect(POSTINST).toMatch(/AGENT_HOST=127\.0\.0\.1/);
    expect(POSTINST).toMatch(/chmod 600 "\$\{ENV_FILE\}"/);
    expect(POSTINST).toMatch(/umask 077/);
  });

  it('never regenerates the token over an existing env file', () => {
    // The generation must sit inside the "file does not exist" branch.
    expect(POSTINST).toMatch(/if \[ ! -f "\$\{ENV_FILE\}" \]; then[\s\S]*openssl rand -hex 32/);
  });

  it('proxies to the port the agent defaults to', () => {
    expect(NGINX).toMatch(/proxy_pass http:\/\/127\.0\.0\.1:46509\//);
    expect(POSTINST).toMatch(/PORT=46509/);
  });

  it('does not let purge delete backups', () => {
    const postrm = read('packaging/debian/postrm');
    const purge = /purge\)([\s\S]*?);;/.exec(postrm)?.[1] ?? '';
    expect(purge).toContain('rm -rf /opt/vpsgui');
    // The path appears in a comment explaining why it is kept; assert no *command* removes it.
    const commands = purge.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
    expect(commands).not.toContain('/var/backups');
  });

  it('declares the runtime dependencies the postinst relies on', () => {
    expect(BUILD).toMatch(/Depends:[^\n]*nginx/);
    expect(BUILD).toMatch(/Depends:[^\n]*openssl/);
  });

  it('bundles Node.js instead of depending on the distro package', () => {
    // A hard "nodejs (>= 18)" makes apt refuse the install on Ubuntu 20.04/22.04, Debian 10/11.
    expect(BUILD).not.toMatch(/Depends:[^\n]*nodejs/);
    // The glibc floor of the bundled binary is what actually bounds support; state it.
    expect(BUILD).toMatch(/Depends:[^\n]*libc6 \(>= 2\.28\)/);
    // ...and libstdc++, which is higher on armhf (GLIBCXX_3.4.26) than on amd64/arm64 (3.4.21).
    expect(BUILD).toMatch(/Depends:[^\n]*libstdc\+\+6 \(>= \$\{LIBSTDCXX_MIN\}\)/);
    expect(NODE_LIB).toMatch(/armhf\)[^\n]*LIBSTDCXX_MIN=9;/);
    const bundled = /ExecStart=(\S+)/.exec(UNIT)?.[1];
    expect(bundled).toBe('/opt/vpsgui/node/bin/node');
    expect(BUILD).toMatch(/bundle_node "\$\{ROOT\}" "\$\{STAGE\}"/);
    expect(NODE_LIB).toContain('"${stage}/opt/vpsgui/node/bin"');
  });

  it('pins a SHA-256 for every architecture it bundles', () => {
    for (const arch of ['amd64', 'arm64', 'armhf']) {
      expect(NODE_LIB, `${arch} needs a pinned hash`).toMatch(new RegExp(`${arch}\\)[^\\n]*NODE_SHA256=[0-9a-f]{64}`));
    }
    expect(NODE_LIB).toMatch(/sha256sum -c/);
  });

  it('builds a per-architecture apt index for every architecture it packages', () => {
    const repo = read('scripts/build-apt-repo.sh');
    expect(repo).toMatch(/ARCHES="amd64 arm64 armhf"/);
    expect(repo).toMatch(/dpkg-scanpackages[^\n]*--arch/);
  });

  it('keeps the maintainer scripts free of CRLF', () => {
    // A CR after the shebang makes the kernel look for an interpreter named "sh\r".
    for (const f of ['postinst', 'prerm', 'postrm']) {
      expect(read(`packaging/debian/${f}`), `${f} has CRLF line endings`).not.toContain('\r');
    }
  });
});

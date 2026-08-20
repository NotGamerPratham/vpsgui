/**
 * Agent daemon integration tests.
 *
 * These boot the real agent/server.js in a child process and exercise it over HTTP, so they cover
 * the security properties that matter: authentication, path confinement, input validation, and
 * body limits. The previous version of this file asserted on object literals it had just written
 * (`expect(payload.cpuCores).toBeGreaterThan(0)` on a hard-coded `cpuCores: 4`), which could never
 * fail, and probed port 8080 where the agent has never listened.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.resolve(__dirname, '../agent/server.js');

const PORT = 46577;
const TOKEN = 'test-token-0123456789abcdef0123456789';
const BASE = `http://127.0.0.1:${PORT}`;
const AUTH = { Authorization: `Bearer ${TOKEN}` };

let child: ChildProcess;
let sandboxRoot: string;

async function waitForHealth(timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/v1/health`);
      if (res.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Agent did not become healthy in time');
}

beforeAll(async () => {
  sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vpsgui-agent-test-'));
  await fs.writeFile(path.join(sandboxRoot, 'sample.txt'), 'hello world\n', 'utf-8');

  child = spawn(process.execPath, [SERVER_PATH], {
    env: {
      ...process.env,
      PORT: String(PORT),
      AGENT_HOST: '127.0.0.1',
      AGENT_TOKEN: TOKEN,
      AGENT_FILE_ROOTS: sandboxRoot,
    },
    stdio: 'ignore',
  });

  await waitForHealth();
}, 30000);

afterAll(async () => {
  child?.kill();
  if (sandboxRoot) await fs.rm(sandboxRoot, { recursive: true, force: true });
});

describe('agent: authentication', () => {
  it('serves /health without a token and leaks nothing about the host', async () => {
    const res = await fetch(`${BASE}/api/v1/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('rejects unauthenticated telemetry reads', async () => {
    const res = await fetch(`${BASE}/api/v1/system/telemetry`);
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated process, package and docker reads', async () => {
    for (const endpoint of ['/system/processes', '/system/packages', '/docker/containers', '/node']) {
      const res = await fetch(`${BASE}/api/v1${endpoint}`);
      expect(res.status, `${endpoint} must require a token`).toBe(401);
    }
  });

  it('rejects a wrong token', async () => {
    const res = await fetch(`${BASE}/api/v1/system/telemetry`, {
      headers: { Authorization: 'Bearer not-the-right-token-at-all' },
    });
    expect(res.status).toBe(401);
  });

  it('accepts the correct token and returns well-formed telemetry', async () => {
    const res = await fetch(`${BASE}/api/v1/system/telemetry`, { headers: AUTH });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.cpuPercent).toBeGreaterThanOrEqual(0);
    expect(body.cpuPercent).toBeLessThanOrEqual(100);
    expect(body.ramPercent).toBeGreaterThanOrEqual(0);
    expect(body.ramPercent).toBeLessThanOrEqual(100);
    expect(body.cpuCores).toBe(os.cpus().length);
    expect(body.memoryTotalBytes).toBe(os.totalmem());
    expect(typeof body.timestamp).toBe('string');
  });

  it('marks privileged responses no-store so they never reach a shared cache', async () => {
    const res = await fetch(`${BASE}/api/v1/system/telemetry`, { headers: AUTH });
    expect(res.headers.get('cache-control')).toContain('no-store');
  });
});

describe('agent: host inventory endpoints', () => {
  // These four backed pages that previously 404'd on every load, so the UI could only ever show
  // an empty state. They must return arrays (possibly empty on platforms lacking the tool) - not 404.
  it.each(['/storage/partitions', '/network/interfaces', '/security/firewall', '/security/ssh-keys'])(
    'implements %s and returns an array',
    async (endpoint) => {
      const res = await fetch(`${BASE}/api/v1${endpoint}`, { headers: AUTH });
      expect(res.status).toBe(200);
      expect(Array.isArray(await res.json())).toBe(true);
    }
  );

  it('reports at least one network interface with a MAC and a stable shape', async () => {
    const res = await fetch(`${BASE}/api/v1/network/interfaces`, { headers: AUTH });
    const interfaces = await res.json();
    expect(interfaces.length).toBeGreaterThan(0);

    for (const iface of interfaces) {
      expect(typeof iface.name).toBe('string');
      expect(['ethernet', 'wireless', 'virtual', 'loopback']).toContain(iface.type);
      expect(typeof iface.rxSpeedMbps).toBe('number');
      expect(iface.rxSpeedMbps).toBeGreaterThanOrEqual(0);
    }
  });

  it('reports a parsed version for every runtime it says is installed', async () => {
    const res = await fetch(`${BASE}/api/v1/system/packages`, { headers: AUTH });
    expect(res.status).toBe(200);
    const { languages, packages } = await res.json();

    expect(Array.isArray(languages)).toBe(true);
    expect(Array.isArray(packages)).toBe(true);

    // The agent runs on Node, so Node is installed by definition. This is the
    // one runtime that can be asserted on unconditionally.
    const node = languages.find((l: { binary: string }) => l.binary === 'node');
    expect(node.installed).toBe(true);

    // Versions used to be the raw first line of the banner: "v22.23.2",
    // "go version go1.22.0 linux/amd64", 'openjdk version "17.0.9"'. Go and
    // Java reported null outright, because `go --version` is not valid Go and
    // `java -version` writes to stderr, which the runner discarded.
    expect(node.version).toMatch(/^\d+\.\d+/);

    for (const lang of languages) {
      if (!lang.installed) {
        // Nothing is claimed about a tool that is not there.
        expect(lang.version).toBeNull();
        continue;
      }
      expect(typeof lang.version === 'string' || lang.version === null).toBe(true);
      if (typeof lang.version === 'string') {
        expect(lang.version).not.toMatch(/^v/);
        expect(lang.version.length).toBeLessThan(40);
      }
    }
  });

  it('probes a PATH wider than the one a service inherits', async () => {
    // Bun installs to ~/.bun/bin and Deno to ~/.deno/bin. A login shell adds
    // those from .bashrc; systemd and pm2 do not, so the agent reported them as
    // not installed on hosts where `bun -v` worked over ssh. There is no way to
    // assert the outcome portably, but the entries must at least be present and
    // well-formed so the UI can offer an install.
    const res = await fetch(`${BASE}/api/v1/system/packages`, { headers: AUTH });
    const { languages } = await res.json();

    for (const binary of ['bun', 'deno']) {
      const entry = languages.find((l: { binary: string }) => l.binary === binary);
      expect(entry).toBeDefined();
      expect(typeof entry.installed).toBe('boolean');
    }
  });

  it('never reports a fabricated SMART verdict', async () => {
    const res = await fetch(`${BASE}/api/v1/storage/partitions`, { headers: AUTH });
    for (const part of await res.json()) {
      // SMART needs smartctl and raw device access; claiming "passed" without checking is a lie.
      expect(part.smartHealth).toBeNull();
      expect(part.usagePercent).toBeGreaterThanOrEqual(0);
      expect(part.usagePercent).toBeLessThanOrEqual(100);
    }
  });

  it.each([
    '/proxy/rules',
    '/databases',
    '/catalog',
    '/deployments',
    '/backups',
    '/security/secrets',
  ])('answers %s with 200 and an array instead of 404', async (endpoint) => {
    // These six 404'd on every page load. Even the ones with no backing implementation return an
    // empty list, so the UI renders an explained empty state rather than logging console errors.
    const res = await fetch(`${BASE}/api/v1${endpoint}`, { headers: AUTH });
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it('serves a catalog whose entries carry a usable image reference', async () => {
    const res = await fetch(`${BASE}/api/v1/catalog`, { headers: AUTH });
    const items = await res.json();
    expect(items.length).toBeGreaterThan(0);

    for (const item of items) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.image).toBe('string');
      // Popularity metrics would need a registry the agent does not query. The UI called
      // .toLocaleString() on downloadsCount, so an invented number here would hide a real crash.
      expect(item.downloadsCount).toBeNull();
      expect(item.rating).toBeNull();
    }
  });

  it('reports no unimplemented features now that all endpoints are backed', async () => {
    // deployments, backups and secrets were previously advertised here as having no
    // implementation; all three are now real, so the list must be empty.
    const res = await fetch(`${BASE}/api/v1/agent/info`, { headers: AUTH });
    const info = await res.json();
    expect(info.unimplementedFeatures).toEqual([]);
  });

  it('requires a token for the inventory endpoints too', async () => {
    for (const endpoint of ['/storage/partitions', '/network/interfaces', '/security/ssh-keys']) {
      const res = await fetch(`${BASE}/api/v1${endpoint}`);
      expect(res.status, `${endpoint} must require a token`).toBe(401);
    }
  });
});

describe('agent: filesystem confinement', () => {
  it('lists a directory inside an allowed root', async () => {
    const res = await fetch(`${BASE}/api/v1/files?path=${encodeURIComponent(sandboxRoot)}`, { headers: AUTH });
    expect(res.status).toBe(200);

    const items = await res.json();
    expect(items.some((i: { name: string }) => i.name === 'sample.txt')).toBe(true);
  });

  it('never embeds file contents in a directory listing', async () => {
    const res = await fetch(`${BASE}/api/v1/files?path=${encodeURIComponent(sandboxRoot)}`, { headers: AUTH });
    const items = await res.json();
    for (const item of items) {
      expect(item).not.toHaveProperty('content');
    }
  });

  it('does not treat a sibling directory as inside the root', async () => {
    // "/etc" must not match "/etcetera" - the separator in the prefix check guards against this.
    const sibling = `${sandboxRoot}-sibling`;
    await fs.mkdir(sibling, { recursive: true });
    try {
      const res = await fetch(`${BASE}/api/v1/files?path=${encodeURIComponent(sibling)}`, { headers: AUTH });
      expect(res.status).toBe(403);
    } finally {
      await fs.rm(sibling, { recursive: true, force: true });
    }
  });

  it('refuses traversal above the configured root', async () => {
    const escape = path.join(sandboxRoot, '..', '..');
    const res = await fetch(`${BASE}/api/v1/files?path=${encodeURIComponent(escape)}`, { headers: AUTH });
    expect(res.status).toBe(403);
  });

  it('refuses an absolute path outside the configured root', async () => {
    const outside = os.platform() === 'win32' ? 'C:\\Windows' : '/etc';
    const res = await fetch(`${BASE}/api/v1/files?path=${encodeURIComponent(outside)}`, { headers: AUTH });
    expect(res.status).toBe(403);
  });

  it('refuses to read credential files even inside an allowed root', async () => {
    const secret = path.join(sandboxRoot, 'id_rsa');
    await fs.writeFile(secret, 'PRIVATE KEY', 'utf-8');
    const res = await fetch(`${BASE}/api/v1/files/read?path=${encodeURIComponent(secret)}`, { headers: AUTH });
    expect(res.status).toBe(403);
  });

  it('reads a file in full and marks it editable', async () => {
    const target = path.join(sandboxRoot, 'sample.txt');
    const res = await fetch(`${BASE}/api/v1/files/read?path=${encodeURIComponent(target)}`, { headers: AUTH });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.content).toBe('hello world\n');
    expect(body.truncated).toBe(false);
    expect(body.editable).toBe(true);
  });

  it('round-trips a write without truncating', async () => {
    const target = path.join(sandboxRoot, 'roundtrip.txt');
    // Larger than the 5000-character prefix the old listing endpoint embedded, which is exactly
    // the case that used to be silently truncated on save.
    const content = 'x'.repeat(12000);

    const write = await fetch(`${BASE}/api/v1/files/write`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: target, content }),
    });
    expect(write.status).toBe(200);

    expect(await fs.readFile(target, 'utf-8')).toHaveLength(12000);
  });

  it('refuses to write outside the configured root', async () => {
    const outside = path.join(os.tmpdir(), 'vpsgui-should-not-exist.txt');
    const res = await fetch(`${BASE}/api/v1/files/write`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: outside, content: 'nope' }),
    });
    expect(res.status).toBe(403);
    await expect(fs.access(outside)).rejects.toBeTruthy();
  });
});

describe('agent: filesystem-root configuration', () => {
  const ROOT_PORT = 46578;
  const ROOT_BASE = `http://127.0.0.1:${ROOT_PORT}`;
  let rootChild: ChildProcess;

  beforeAll(async () => {
    // AGENT_FILE_ROOTS set to the filesystem root is a legitimate (if wide-open) configuration.
    // It used to reject every path because the containment prefix became "//".
    const fsRoot = path.parse(process.cwd()).root;
    rootChild = spawn(process.execPath, [SERVER_PATH], {
      env: {
        ...process.env,
        PORT: String(ROOT_PORT),
        AGENT_HOST: '127.0.0.1',
        AGENT_TOKEN: TOKEN,
        AGENT_FILE_ROOTS: fsRoot,
      },
      stdio: 'ignore',
    });

    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      try {
        if ((await fetch(`${ROOT_BASE}/api/v1/health`)).ok) return;
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('Agent with filesystem root did not start');
  }, 30000);

  afterAll(() => rootChild?.kill());

  it('allows browsing below the filesystem root when configured that way', async () => {
    const res = await fetch(`${ROOT_BASE}/api/v1/files?path=${encodeURIComponent(process.cwd())}`, {
      headers: AUTH,
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it('still blocks credential files even with the filesystem root configured', async () => {
    const secret = path.join(process.cwd(), 'agent', '.agent-token');
    const res = await fetch(`${ROOT_BASE}/api/v1/files/read?path=${encodeURIComponent(secret)}`, {
      headers: AUTH,
    });
    expect(res.status).toBe(403);
  });

  it.each([
    ['agent.env', 'agent.env'],
    ['secret store', '.secrets.json'],
    ['secret key', '.secrets-key'],
  ])("refuses to serve the agent's own %s", async (_label, filename) => {
    // AGENT_FILE_ROOTS now defaults to "/", so these files are reachable by path. Serving any of
    // them would hand over the bearer token or every stored secret in a single request.
    const target = path.join(process.cwd(), 'agent', filename);
    await fs.writeFile(target, 'canary', 'utf-8').catch(() => { });
    try {
      const read = await fetch(`${ROOT_BASE}/api/v1/files/read?path=${encodeURIComponent(target)}`, {
        headers: AUTH,
      });
      expect(read.status).toBe(403);

      // Writing over them must be refused too, or the token could simply be replaced.
      const write = await fetch(`${ROOT_BASE}/api/v1/files/write`, {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: target, content: 'overwritten' }),
      });
      expect(write.status).toBe(403);
    } finally {
      await fs.rm(target, { force: true }).catch(() => { });
    }
  });

  it('lists a directory but marks blocked entries unreadable', async () => {
    const res = await fetch(
      `${ROOT_BASE}/api/v1/files?path=${encodeURIComponent(path.join(process.cwd(), 'agent'))}`,
      { headers: AUTH }
    );
    expect(res.status).toBe(200);

    for (const entry of await res.json()) {
      if (/^(agent\.env|\.secrets\.json|\.secrets-key|\.agent-token)$/.test(entry.name)) {
        expect(entry.readable, `${entry.name} must be flagged unreadable`).toBe(false);
      }
    }
  });
});

describe('agent: input validation', () => {
  it('rejects prototype-chain values used as a docker action', async () => {
    for (const action of ['constructor', '__proto__', 'toString']) {
      const res = await fetch(`${BASE}/api/v1/docker/containers/action`, {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'abc123', action }),
      });
      expect(res.status, `action=${action} must be rejected`).toBe(400);
    }
  });

  it('rejects prototype-chain values used as a service action', async () => {
    const res = await fetch(`${BASE}/api/v1/system/services/action`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'nginx', action: '__proto__' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects package names that could smuggle apt flags or paths', async () => {
    for (const packageName of ['--allow-downgrades', '../../etc/passwd', 'foo;rm -rf /', '-oDpkg::Options']) {
      const res = await fetch(`${BASE}/api/v1/system/packages/install`, {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageName }),
      });
      expect(res.status, `packageName=${packageName} must be rejected`).toBe(400);
    }
  });

  it('rejects a container id containing shell metacharacters', async () => {
    const res = await fetch(`${BASE}/api/v1/docker/containers/action`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'abc; rm -rf /', action: 'stop' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects an oversized request body with 413 rather than dropping the connection', async () => {
    const res = await fetch(`${BASE}/api/v1/terminal/exec`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'x'.repeat(200_000) }),
    });
    expect(res.status).toBe(413);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await fetch(`${BASE}/api/v1/terminal/exec`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: '{not valid json',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a cross-origin request from an origin that is not allowlisted', async () => {
    const res = await fetch(`${BASE}/api/v1/system/telemetry`, {
      headers: { ...AUTH, Origin: 'https://evil.example' },
    });
    expect(res.status).toBe(403);
  });

  it('allows a same-origin write that carries an Origin header', async () => {
    // Browsers attach Origin to same-origin POSTs but not same-origin GETs. Rejecting on the mere
    // presence of Origin made every write from the app's own page fail with 403 while reads worked.
    const res = await fetch(`${BASE}/api/v1/terminal/exec`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${PORT}` },
      body: JSON.stringify({ command: 'echo same-origin-write' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).output).toContain('same-origin-write');
  });

  it('allows a same-host write when a proxy rewrote the port out of the Host header', async () => {
    // nginx's `$host` drops the port while the browser's Origin keeps it. Comparing host:port
    // rejected every write on any deployment not served on the default port.
    const res = await fetch(`${BASE}/api/v1/terminal/exec`, {
      method: 'POST',
      headers: {
        ...AUTH,
        'Content-Type': 'application/json',
        Host: '127.0.0.1',
        Origin: 'http://127.0.0.1:8443',
      },
      body: JSON.stringify({ command: 'echo proxied-write' }),
    });
    expect(res.status).toBe(200);
  });

  it('still rejects a write from a different host entirely', async () => {
    const res = await fetch(`${BASE}/api/v1/terminal/exec`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      body: JSON.stringify({ command: 'echo nope' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown endpoints', async () => {
    const res = await fetch(`${BASE}/api/v1/nodes/batch-exec`, { headers: AUTH });
    expect(res.status).toBe(404);
  });
});

describe('agent: shell execution', () => {
  it('runs a command and returns its output', async () => {
    const res = await fetch(`${BASE}/api/v1/terminal/exec`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'echo vpsgui-test' }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.output).toContain('vpsgui-test');
  });

  it('reports a failing command as unsuccessful instead of "executed cleanly"', async () => {
    const res = await fetch(`${BASE}/api/v1/terminal/exec`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'exit 3' }),
    });
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('rejects an empty command', async () => {
    const res = await fetch(`${BASE}/api/v1/terminal/exec`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: '   ' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('agent: failed-auth lockout is per-client', () => {
  const badAuth = { Authorization: 'Bearer wrong-token-aaaaaaaaaaaaaaaa' };

  it('does not lock out a second client when a first one sends bad tokens', async () => {
    // Behind nginx every request arrives from 127.0.0.1, so keying the lockout on the socket
    // address made it global: one browser with a stale token 429'd the entire application for
    // everyone. The agent trusts X-Forwarded-For only from a loopback peer, and uses the rightmost
    // hop - the one our own nginx appended.
    for (let i = 0; i < 15; i++) {
      await fetch(`${BASE}/api/v1/system/telemetry`, {
        headers: { ...badAuth, 'X-Forwarded-For': '203.0.113.10' },
      });
    }

    const offender = await fetch(`${BASE}/api/v1/system/telemetry`, {
      headers: { ...badAuth, 'X-Forwarded-For': '203.0.113.10' },
    });
    expect(offender.status).toBe(429);

    // A different client must be unaffected, and a valid token must still work.
    const bystander = await fetch(`${BASE}/api/v1/system/telemetry`, {
      headers: { ...AUTH, 'X-Forwarded-For': '203.0.113.99' },
    });
    expect(bystander.status).toBe(200);
  });

  it('ignores a forged leftmost X-Forwarded-For hop', async () => {
    // A client that spoofs XFF must not be able to pin the lockout on someone else: nginx appends
    // the real peer last, so only the rightmost entry is trustworthy.
    for (let i = 0; i < 15; i++) {
      await fetch(`${BASE}/api/v1/system/telemetry`, {
        headers: { ...badAuth, 'X-Forwarded-For': '198.51.100.7, 203.0.113.55' },
      });
    }

    const victim = await fetch(`${BASE}/api/v1/system/telemetry`, {
      headers: { ...AUTH, 'X-Forwarded-For': '198.51.100.7' },
    });
    expect(victim.status).toBe(200);
  });
});

describe('agent: previously-404 page endpoints', () => {
  it.each([
    '/users',
    '/security/audit-logs',
    '/health/matrix',
    '/topology',
    '/queue/jobs',
    '/automation/workflows',
  ])('implements %s and returns an array', async (endpoint) => {
    const res = await fetch(`${BASE}/api/v1${endpoint}`, { headers: AUTH });
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it('requires a token for all of them', async () => {
    for (const endpoint of ['/users', '/security/audit-logs', '/health/matrix', '/topology']) {
      const res = await fetch(`${BASE}/api/v1${endpoint}`);
      expect(res.status, `${endpoint} must require a token`).toBe(401);
    }
  });

  it('computes health checks from measured state, with valid statuses', async () => {
    const res = await fetch(`${BASE}/api/v1/health/matrix`, { headers: AUTH });
    const checks = await res.json();
    expect(checks.length).toBeGreaterThan(0);

    for (const check of checks) {
      // Every check must carry a real verdict and the reading it was derived from.
      expect(['green', 'yellow', 'red']).toContain(check.status);
      expect(typeof check.message).toBe('string');
      expect(check.message.length).toBeGreaterThan(0);
      expect(Number.isNaN(new Date(check.lastCheck).getTime())).toBe(false);
    }

    // The agent reporting on itself must always be present.
    expect(checks.some((c: { id: string }) => c.id === 'health-agent')).toBe(true);
  });

  it('builds topology layers from the real host rather than a fixed graph', async () => {
    const res = await fetch(`${BASE}/api/v1/topology`, { headers: AUTH });
    const layers = await res.json();

    const host = layers.find((l: { level: string }) => l.level === 'Host');
    expect(host).toBeDefined();
    expect(host.items[0].title).toBe(os.hostname());
    expect(host.items[0].desc).toContain(`${os.cpus().length} vCPU`);
  });
});

describe('agent: firewall rule validation', () => {
  const post = (body: unknown) =>
    fetch(`${BASE}/api/v1/security/firewall/action`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it.each([
    ['shell metacharacters in port', { action: 'allow', port: '22; rm -rf /' }],
    ['prototype-chain action', { action: 'constructor', port: '22' }],
    ['port out of range', { action: 'allow', port: '99999' }],
    ['injection in source', { action: 'allow', port: '22', source: '1.2.3.4; ls' }],
    ['non-numeric rule number', { action: 'delete', ruleNumber: 'abc' }],
    ['unknown protocol', { action: 'allow', port: '22', protocol: 'evil' }],
  ])('rejects %s', async (_label, body) => {
    // Validation runs before the platform check, so a malformed payload is a 400 on any host.
    expect((await post(body)).status).toBe(400);
  });

  it('accepts a well-formed rule', async () => {
    const res = await post({ action: 'allow', port: '8080', protocol: 'tcp', source: 'any' });
    expect(res.status).toBe(200);
  });

  it('requires a token', async () => {
    const res = await fetch(`${BASE}/api/v1/security/firewall/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'allow', port: '22' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('agent: filesystem mutations', () => {
  const post = (endpoint: string, body: unknown) =>
    fetch(`${BASE}/api/v1/files/${endpoint}`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('creates, renames and deletes inside the sandbox', async () => {
    const dir = path.join(sandboxRoot, 'ops');
    expect((await post('mkdir', { path: dir })).status).toBe(200);

    const file = path.join(dir, 'a.txt');
    await post('write', { path: file, content: 'hi' });

    const renamed = path.join(dir, 'b.txt');
    expect((await post('rename', { from: file, to: renamed })).status).toBe(200);
    expect(await fs.readFile(renamed, 'utf-8')).toBe('hi');

    expect((await post('delete', { path: renamed })).status).toBe(200);
    expect((await post('delete', { path: dir })).status).toBe(200);
  });

  it('refuses to overwrite an existing path on rename', async () => {
    const a = path.join(sandboxRoot, 'x.txt');
    const b = path.join(sandboxRoot, 'y.txt');
    await post('write', { path: a, content: 'a' });
    await post('write', { path: b, content: 'b' });

    // rename() would silently clobber the destination.
    expect((await post('rename', { from: a, to: b })).status).toBe(409);
    expect(await fs.readFile(b, 'utf-8')).toBe('b');
  });

  it('refuses to delete a non-empty directory unless recursion is requested', async () => {
    const dir = path.join(sandboxRoot, 'tree');
    await post('mkdir', { path: dir });
    await post('write', { path: path.join(dir, 'child.txt'), content: 'c' });

    expect((await post('delete', { path: dir })).status).toBe(400);
    expect((await post('delete', { path: dir, recursive: true })).status).toBe(200);
  });

  it('refuses to delete a configured file root', async () => {
    expect((await post('delete', { path: sandboxRoot, recursive: true })).status).toBe(403);
  });

  it.each(['mkdir', 'delete'])('confines %s to the configured roots', async (endpoint) => {
    const outside = os.platform() === 'win32' ? path.join('C:', 'Windows', 'vpsgui-nope') : '/etc/vpsgui-nope';
    expect((await post(endpoint, { path: outside })).status).toBe(403);
  });

  it('confines both ends of a rename', async () => {
    const inside = path.join(sandboxRoot, 'sample.txt');
    const outside = os.platform() === 'win32' ? path.join('C:', 'Windows', 'escaped.txt') : '/etc/escaped.txt';
    expect((await post('rename', { from: inside, to: outside })).status).toBe(403);
  });
});

describe('agent: secrets are encrypted at rest', () => {
  const post = (endpoint: string, body: unknown) =>
    fetch(`${BASE}/api/v1/${endpoint}`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const SECRET_VALUE = 'plaintext-canary-value-9f3a';

  afterAll(async () => {
    await post('security/secrets/delete', { name: 'TEST_SECRET' }).catch(() => { });
  });

  it('never writes the plaintext value to disk', async () => {
    expect((await post('security/secrets', { name: 'TEST_SECRET', value: SECRET_VALUE })).status).toBe(200);

    const store = await fs.readFile(path.resolve(__dirname, '../agent/.secrets.json'), 'utf-8');
    // The whole point of the store: the value must not be recoverable by reading the file.
    expect(store).not.toContain(SECRET_VALUE);
    expect(store).toContain('TEST_SECRET');
  });

  it('omits values from the list and returns them only on explicit reveal', async () => {
    const list = await (await fetch(`${BASE}/api/v1/security/secrets`, { headers: AUTH })).json();
    const entry = list.find((s: { name: string }) => s.name === 'TEST_SECRET');
    expect(entry).toBeDefined();
    expect(JSON.stringify(entry)).not.toContain(SECRET_VALUE);

    const revealed = await (await post('security/secrets/reveal', { name: 'TEST_SECRET' })).json();
    expect(revealed.value).toBe(SECRET_VALUE);
  });

  it('rejects invalid names and oversized values', async () => {
    expect((await post('security/secrets', { name: 'bad name!', value: 'x' })).status).toBe(400);
    expect((await post('security/secrets', { name: 'OK_NAME', value: '' })).status).toBe(400);
    expect((await post('security/secrets', { name: 'OK_NAME', value: 'x'.repeat(9000) })).status).toBe(400);
  });

  it('404s on revealing or deleting an unknown secret', async () => {
    expect((await post('security/secrets/reveal', { name: 'NOPE' })).status).toBe(404);
    expect((await post('security/secrets/delete', { name: 'NOPE' })).status).toBe(404);
  });

  it('requires a token', async () => {
    const res = await fetch(`${BASE}/api/v1/security/secrets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X', value: 'y' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('agent: backups, deployments and image removal', () => {
  const post = (endpoint: string, body: unknown) =>
    fetch(`${BASE}/api/v1/${endpoint}`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it.each(['/deployments', '/backups'])('serves %s as an array', async (endpoint) => {
    const res = await fetch(`${BASE}/api/v1${endpoint}`, { headers: AUTH });
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it('confines a backup source to the configured roots', async () => {
    const outside = os.platform() === 'win32' ? path.join('C:', 'Windows') : '/root';
    expect((await post('backups/create', { sourcePath: outside })).status).toBe(403);
  });

  it.each(['../../etc/passwd', 'x.tar.gz; ls', 'nope.txt'])('rejects archive name %s', async (name) => {
    // The name pattern excludes separators, so a delete cannot escape the backup directory.
    expect((await post('backups/delete', { name })).status).toBe(400);
  });

  it('refuses to pull a path that is not a known deployment', async () => {
    expect((await post('deployments/pull', { path: sandboxRoot })).status).toBe(403);
  });

  it.each([
    ['prototype-chain action', { id: 'abc', action: 'constructor' }],
    ['shell metacharacters in id', { id: 'a; rm -rf /', action: 'remove' }],
    ['missing id', { action: 'remove' }],
  ])('rejects docker image removal with %s', async (_label, body) => {
    expect((await post('docker/images/action', body)).status).toBe(400);
  });

  it('accepts a well-formed image reference', async () => {
    expect((await post('docker/images/action', { id: 'nginx:alpine', action: 'remove' })).status).toBe(200);
  });
});

describe('agent: IP geolocation proxy', () => {
  it('requires a token', async () => {
    expect((await fetch(`${BASE}/api/v1/network/ip-info?ip=8.8.8.8`)).status).toBe(401);
  });

  it('returns a stable shape and never fabricates a location', async () => {
    // Network-dependent, so the values are not asserted - only that every field is present and
    // that a field the provider did not supply is null rather than a plausible-looking guess.
    const res = await fetch(`${BASE}/api/v1/network/ip-info?ip=8.8.8.8`, { headers: AUTH });
    expect(res.status).toBe(200);

    const info = await res.json();
    for (const key of ['ip', 'city', 'region', 'country', 'countryCode', 'org', 'asn', 'source']) {
      expect(info, `missing key: ${key}`).toHaveProperty(key);
    }
    for (const key of ['city', 'region', 'country', 'countryCode', 'org', 'asn']) {
      expect(info[key] === null || typeof info[key] === 'string').toBe(true);
    }
    // No provider answered => nothing may be reported as if it had.
    if (info.source === null) {
      expect(info.city).toBeNull();
      expect(info.country).toBeNull();
    }
  });

  it('reports whether a token is configured without disclosing it', async () => {
    const info = await (await fetch(`${BASE}/api/v1/agent/info`, { headers: AUTH })).json();
    expect(typeof info.ipinfoConfigured).toBe('boolean');
    // The token is an API credential; the info endpoint must never carry it.
    expect(JSON.stringify(info)).not.toMatch(/token/i);
  });
});

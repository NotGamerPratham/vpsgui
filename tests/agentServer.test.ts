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
  // an empty state. They must return arrays (possibly empty on platforms lacking the tool) — not 404.
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

  it('never reports a fabricated SMART verdict', async () => {
    const res = await fetch(`${BASE}/api/v1/storage/partitions`, { headers: AUTH });
    for (const part of await res.json()) {
      // SMART needs smartctl and raw device access; claiming "passed" without checking is a lie.
      expect(part.smartHealth).toBeNull();
      expect(part.usagePercent).toBeGreaterThanOrEqual(0);
      expect(part.usagePercent).toBeLessThanOrEqual(100);
    }
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
    // "/etc" must not match "/etcetera" — the separator in the prefix check guards against this.
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

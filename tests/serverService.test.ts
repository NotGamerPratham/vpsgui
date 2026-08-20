/**
 * ServerService tests.
 *
 * The previous suite expected `createNode({ name: 'test-node-01', ... })` to return a node named
 * 'test-node-01' with status 'online'. It never ran (no test runner was installed), and it would
 * have failed: createNode ignored its payload entirely and returned the default host node.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { serverService } from '../src/services/serverService';
import { fetchReturning, fetchFailing } from './helpers/fetchMock';

const payload = {
  name: 'test-node-01',
  type: 'linux' as const,
  ipAddress: '127.0.0.1',
  sshPort: 22,
  authMethod: 'password' as const,
  sshUser: 'root',
  tags: ['test'],
  autoInstallAgent: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('serverService.getNodes', () => {
  it('always returns an array, even without localStorage', () => {
    // These tests run in the node environment where localStorage is undefined; the service must
    // degrade to its default host node rather than throwing.
    expect(Array.isArray(serverService.getNodes())).toBe(true);
  });

  it('returns exactly one node - VPSGUI manages a single host', () => {
    expect(serverService.getNodes()).toHaveLength(1);
  });
});

describe('serverService.createNode', () => {
  it('rejects rather than silently returning a different node', async () => {
    // Returning the default host node here is what made "add node" look like it worked while
    // producing a node with the wrong name that vanished on reload.
    await expect(serverService.createNode(payload)).rejects.toThrow(/not supported/i);
  });
});

describe('serverService.rebootNode', () => {
  it('reports success when the agent accepts the reboot command', async () => {
    vi.stubGlobal('fetch', fetchReturning({ success: true, output: '' }));

    const result = await serverService.rebootNode();
    expect(result.success).toBe(true);
  });

  it('reports failure when the agent rejects the command', async () => {
    vi.stubGlobal('fetch', fetchReturning({ success: false, output: 'Interactive authentication required' }));

    const result = await serverService.rebootNode();
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/authentication/i);
  });

  it('treats a dropped connection as a probable reboot rather than an error', async () => {
    // `systemctl reboot` frequently kills the connection before the response is written.
    vi.stubGlobal('fetch', fetchFailing());

    const result = await serverService.rebootNode();
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/rebooting/i);
  });

  it('reports a 401 as a missing agent token, not as a reboot', async () => {
    vi.stubGlobal('fetch', fetchReturning({ error: 'Unauthorized' }, { status: 401 }));

    const result = await serverService.rebootNode();
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/agent token/i);
  });
});

describe('serverService.queryAgent', () => {
  it('returns null when no endpoint yields a usable node payload', async () => {
    vi.stubGlobal('fetch', fetchFailing());
    expect(await serverService.queryAgent('127.0.0.1')).toBeNull();
  });

  it('ignores a response that lacks real hardware data', async () => {
    // A JSON 200 from something that is not the agent must not be mistaken for a node.
    vi.stubGlobal('fetch', fetchReturning({ hello: 'world' }));
    expect(await serverService.queryAgent('127.0.0.1')).toBeNull();
  });

  it('accepts a payload carrying hardware details', async () => {
    vi.stubGlobal('fetch', fetchReturning({ name: 'vps01', hardware: { cpuCores: 8 } }));

    const node = await serverService.queryAgent('127.0.0.1');
    expect(node?.name).toBe('vps01');
  });
});

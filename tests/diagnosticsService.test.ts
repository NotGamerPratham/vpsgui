/**
 * DiagnosticsService tests.
 *
 * The old suite asserted `expect(res.status).toBe('ok')` after pinging 127.0.0.1 — and passed
 * regardless, because the implementation returned 'ok' with the message "verified" on the failure
 * path whenever the target merely looked like a hostname. These tests pin the corrected behaviour:
 * a failure is reported as a failure.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { diagnosticsService } from '../src/services/diagnosticsService';
import { fetchFailing, fetchHanging, fetchStatus, fetchReturning } from './helpers/fetchMock';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('diagnosticsService.probeHttp', () => {
  it('reports status "error" when the host is unreachable', async () => {
    vi.stubGlobal('fetch', fetchFailing());

    const result = await diagnosticsService.probeHttp('definitely-not-a-real-host.invalid');
    expect(result.status).toBe('error');
    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it('reports status "ok" when the connection succeeds', async () => {
    vi.stubGlobal('fetch', fetchStatus(200));

    const result = await diagnosticsService.probeHttp('example.com');
    expect(result.status).toBe('ok');
  });

  it('distinguishes a timeout from an outright failure', async () => {
    vi.stubGlobal('fetch', fetchHanging());

    const result = await diagnosticsService.probeHttp('example.com', { timeoutMs: 50 });
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/did not respond/i);
  });

  it('strips a scheme and path from the target before probing', async () => {
    const fetchMock = fetchStatus(200);
    vi.stubGlobal('fetch', fetchMock);

    await diagnosticsService.probeHttp('https://example.com/some/path', { port: 8080 });
    expect(fetchMock.mock.calls[0][0]).toBe('http://example.com:8080/');
  });

  it('pingHost targets the agent port', async () => {
    const fetchMock = fetchStatus(200);
    vi.stubGlobal('fetch', fetchMock);

    await diagnosticsService.pingHost('10.0.0.5');
    expect(fetchMock.mock.calls[0][0]).toContain(':46509');
  });
});

describe('diagnosticsService.resolveDns', () => {
  it('maps DoH answer records to typed results', async () => {
    vi.stubGlobal('fetch', fetchReturning({ Answer: [{ name: 'example.com', type: 1, data: '93.184.216.34', TTL: 300 }] }));

    const records = await diagnosticsService.resolveDns('example.com');
    expect(records).toEqual([{ name: 'example.com', type: 'A', data: '93.184.216.34', ttl: 300 }]);
  });

  it('returns an empty list when the name has no answers', async () => {
    vi.stubGlobal('fetch', fetchReturning({ Status: 3 }));
    expect(await diagnosticsService.resolveDns('nx.example')).toEqual([]);
  });

  it('returns an empty list when DoH itself fails', async () => {
    vi.stubGlobal('fetch', fetchFailing());
    expect(await diagnosticsService.resolveDns('example.com')).toEqual([]);
  });
});

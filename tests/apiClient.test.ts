/**
 * ApiClient tests.
 *
 * The previous suite asserted `expect(apiClient).toBeDefined()` and swallowed every error in a
 * try/catch with an `expect` that only ran on the failure path - it passed whether or not the
 * client worked. These stub global fetch and assert on real behaviour.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiClient, ApiError, AGENT_TOKEN_STORAGE_KEY } from '../src/api/client';
import { fetchReturning, fetchFailing, fetchHanging, FetchLike } from './helpers/fetchMock';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ApiClient', () => {
  it('exposes the storage key the settings page writes the agent token to', () => {
    // These two must stay in sync, or saving a token silently has no effect on requests.
    expect(AGENT_TOKEN_STORAGE_KEY).toBe('vpsgui_auth_token');
  });

  it('parses a successful JSON response', async () => {
    vi.stubGlobal("fetch", fetchReturning({ cpuPercent: 42 }));
    await expect(apiClient.get('/system/telemetry')).resolves.toEqual({ cpuPercent: 42 });
  });

  it('requests with cache disabled so stale host data is never served', async () => {
    const fetchMock = fetchReturning({});
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.get('/system/telemetry');
    expect(fetchMock.mock.calls[0][1].cache).toBe('no-store');
  });

  it('throws an ApiError carrying the HTTP status', async () => {
    vi.stubGlobal('fetch', fetchReturning({ error: 'nope' }, { status: 401 }));

    await expect(apiClient.get('/system/telemetry')).rejects.toBeInstanceOf(ApiError);
    await expect(apiClient.get('/system/telemetry')).rejects.toMatchObject({ status: 401 });
  });

  it("surfaces the agent's own error message rather than a generic status line", async () => {
    vi.stubGlobal('fetch', fetchReturning({ error: 'Path is outside the configured agent file roots' }, { status: 403 }));

    await expect(apiClient.get('/files?path=/')).rejects.toThrow('Path is outside the configured agent file roots');
  });

  it('classifies 401/403/429 as auth errors and 500 as not', async () => {
    const authError = new ApiError('x', 401, '/e');
    const lockedOut = new ApiError('x', 429, '/e');
    const serverError = new ApiError('x', 500, '/e');

    expect(authError.isAuthError).toBe(true);
    expect(lockedOut.isAuthError).toBe(true);
    expect(serverError.isAuthError).toBe(false);
  });

  it('reports a network failure as status 0 instead of leaking a raw TypeError', async () => {
    vi.stubGlobal('fetch', fetchFailing());

    await expect(apiClient.get('/system/telemetry')).rejects.toMatchObject({ status: 0 });
  });

  it('aborts a hung request rather than pending forever', async () => {
    // Settles only when the AbortController fires, mimicking an agent that accepts the connection
    // and never answers. Without the timeout the returned promise would never settle.
    vi.stubGlobal('fetch', fetchHanging());

    await expect(apiClient.get('/system/telemetry', 50)).rejects.toThrow(/timed out/i);
  });

  it('handles a 204 with no body', async () => {
    vi.stubGlobal('fetch', vi.fn<FetchLike>(async () => new Response(null, { status: 204 })));
    await expect(apiClient.delete('/thing')).resolves.toBeUndefined();
  });

  it('does not choke on a non-JSON error body (e.g. an nginx error page)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchLike>(async () => new Response('<html>502 Bad Gateway</html>', { status: 502 }))
    );

    await expect(apiClient.get('/system/telemetry')).rejects.toMatchObject({ status: 502 });
  });

  it('sends a JSON content-type only when there is a body', async () => {
    const fetchMock = fetchReturning({});
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.get('/a');
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Content-Type');

    await apiClient.post('/b', { x: 1 });
    expect(fetchMock.mock.calls[1][1].headers).toHaveProperty('Content-Type', 'application/json');
  });
});

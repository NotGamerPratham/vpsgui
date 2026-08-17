/**
 * DockerService tests.
 *
 * The previous suite only checked `expect(dockerService).toBeDefined()` and that the fetch helpers
 * returned arrays — assertions that held even when the service swallowed every error into an empty
 * list, which is exactly the bug that made an unreachable Docker socket look like a host with no
 * containers.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { dockerService } from '../src/services/dockerService';
import { fetchReturning, fetchFailing, bodyOf } from './helpers/fetchMock';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('dockerService', () => {
  it('returns containers with no error on success', async () => {
    vi.stubGlobal('fetch', fetchReturning([{ id: 'abc', name: 'web', image: 'nginx' }]));

    const result = await dockerService.fetchContainers();
    expect(result.containers).toHaveLength(1);
    expect(result.error).toBeNull();
  });

  it('reports an unreachable agent instead of pretending there are zero containers', async () => {
    vi.stubGlobal('fetch', fetchFailing());

    const result = await dockerService.fetchContainers();
    expect(result.containers).toEqual([]);
    // An empty list with a null error is indistinguishable from a host that genuinely has none.
    expect(result.error).toBeTruthy();
  });

  it('explains a 401 as a missing agent token', async () => {
    vi.stubGlobal('fetch', fetchReturning({ error: 'Unauthorized' }, { status: 401 }));

    const result = await dockerService.fetchImages();
    expect(result.error).toMatch(/agent token/i);
  });

  it('reports a failed container action as unsuccessful', async () => {
    vi.stubGlobal('fetch', fetchFailing());

    const result = await dockerService.controlContainer('abc', 'stop');
    expect(result.success).toBe(false);
    expect(result.output).toBeTruthy();
  });

  it('passes the action through verbatim so the agent can validate it', async () => {
    const fetchMock = fetchReturning({ success: true, output: '' });
    vi.stubGlobal('fetch', fetchMock);

    await dockerService.controlContainer('abc123', 'restart');
    expect(bodyOf(fetchMock)).toEqual({ id: 'abc123', action: 'restart' });
  });

  it('guards against a non-array response body', async () => {
    vi.stubGlobal('fetch', fetchReturning({ unexpected: true }));

    const result = await dockerService.fetchContainers();
    expect(result.containers).toEqual([]);
  });
});

/**
 * MetricsService tests.
 *
 * fetchLiveTelemetry must return null (not a zeroed point) when the agent is unreachable, because
 * the telemetry poller uses null to drive the UI's "disconnected" indicator. Returning zeros would
 * render a flat, healthy-looking chart for a host that is not reporting at all.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { metricsService } from '../src/services/metricsService';
import { fetchReturning, fetchFailing } from './helpers/fetchMock';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('metricsService', () => {
  it('returns a telemetry point on success', async () => {
    vi.stubGlobal('fetch', fetchReturning({ cpuPercent: 12, ramPercent: 44, timestamp: '2026-01-01T00:00:00.000Z' }));

    const point = await metricsService.fetchLiveTelemetry();
    expect(point?.cpuPercent).toBe(12);
    expect(point?.ramPercent).toBe(44);
  });

  it('returns null when the agent is unreachable', async () => {
    vi.stubGlobal('fetch', fetchFailing());
    expect(await metricsService.fetchLiveTelemetry()).toBeNull();
  });

  it('returns null on a 401 rather than surfacing a broken point', async () => {
    vi.stubGlobal('fetch', fetchReturning({ error: 'Unauthorized' }, { status: 401 }));
    expect(await metricsService.fetchLiveTelemetry()).toBeNull();
  });

  it('returns process rows on success', async () => {
    vi.stubGlobal('fetch', fetchReturning([{ pid: 1, user: 'root', command: 'systemd' }]));

    const processes = await metricsService.fetchProcesses();
    expect(processes).toHaveLength(1);
    expect(processes[0].pid).toBe(1);
  });

  it('returns an empty process list rather than throwing', async () => {
    vi.stubGlobal('fetch', fetchFailing());
    expect(await metricsService.fetchProcesses()).toEqual([]);
  });
});

/**
 * System Telemetry & Process Metrics Service
 * Developed by NotGamerPratham (https://notgamerpratham.com)
 *
 * Talks to the host Linux VPS agent to read live CPU/RAM usage and the top system processes.
 */

import { TelemetryPoint, ProcessItem } from '../types/monitoring';
import { apiClient, ApiError } from '../api/client';

export interface TelemetryResult {
  point: TelemetryPoint | null;
  /**
   * Set when the request failed. `auth` means the agent rejected or rate-limited the credentials —
   * retrying on a timer cannot fix it and actively makes it worse, because repeated bad-token
   * requests keep re-arming the agent's failed-auth lockout.
   */
  error: { kind: 'auth' | 'network'; message: string } | null;
}

function classify(e: unknown): { kind: 'auth' | 'network'; message: string } {
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) {
      return { kind: 'auth', message: 'Unauthorized — set a valid Agent Token under Settings.' };
    }
    if (e.status === 429) {
      return {
        kind: 'auth',
        message: 'The agent is rate-limiting this client after repeated failed authentication. Fix the Agent Token, then wait a few minutes.',
      };
    }
    return { kind: 'network', message: e.message };
  }
  return { kind: 'network', message: e instanceof Error ? e.message : 'Unknown error' };
}

class MetricsService {
  /** A single telemetry snapshot; callers build their own rolling window. null when unavailable. */
  async fetchLiveTelemetry(): Promise<TelemetryPoint | null> {
    return (await this.fetchLiveTelemetryResult()).point;
  }

  /**
   * Telemetry plus the reason it failed, so a polling caller can tell a transient outage apart from
   * a credential problem and stop hammering the agent.
   */
  async fetchLiveTelemetryResult(): Promise<TelemetryResult> {
    try {
      return { point: await apiClient.get<TelemetryPoint>('/system/telemetry'), error: null };
    } catch (e) {
      return { point: null, error: classify(e) };
    }
  }

  /** Top active system processes from the host kernel. */
  async fetchProcesses(): Promise<ProcessItem[]> {
    try {
      const res = await apiClient.get<ProcessItem[]>('/system/processes');
      return Array.isArray(res) ? res : [];
    } catch (e) {
      return [];
    }
  }
}

export const metricsService = new MetricsService();

/**
 * System Telemetry & Process Metrics Service
 * Developed by NotGamerPratham (https://notgamerpratham.com)
 * 
 * Hey dev! :) This service communicates with the host Linux VPS agent API to stream live CPU/RAM usage and top system processes.
 */

import { TelemetryPoint, ProcessItem } from '../types/monitoring';
import { apiClient } from '../api/client';

class MetricsService {
  // Fetch real-time host CPU & RAM telemetry stream :)
  async fetchLiveTelemetry(): Promise<TelemetryPoint[]> {
    try {
      return await apiClient.get<TelemetryPoint[]>('/system/telemetry');
    } catch (e) {
      // If endpoint is unreachable, return empty telemetry array :(
      return [];
    }
  }

  // Fetch top active system processes from host Linux VPS kernel :)
  async fetchProcesses(): Promise<ProcessItem[]> {
    try {
      return await apiClient.get<ProcessItem[]>('/system/processes');
    } catch (e) {
      // Process table query fallback :(
      return [];
    }
  }
}

export const metricsService = new MetricsService();

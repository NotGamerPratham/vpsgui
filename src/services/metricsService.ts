import { TelemetryPoint, ProcessItem } from '../types/monitoring';
import { apiClient } from '../api/client';

class MetricsService {
  async fetchLiveTelemetry(): Promise<TelemetryPoint[]> {
    try {
      return await apiClient.get<TelemetryPoint[]>('/system/telemetry');
    } catch (e) {
      return [];
    }
  }

  async fetchProcesses(): Promise<ProcessItem[]> {
    try {
      return await apiClient.get<ProcessItem[]>('/system/processes');
    } catch (e) {
      return [];
    }
  }
}

export const metricsService = new MetricsService();

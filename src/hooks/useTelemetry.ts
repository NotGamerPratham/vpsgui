import { useState, useEffect, useCallback } from 'react';
import { metricsService } from '../services/metricsService';
import { TelemetryPoint, ProcessItem } from '../types/monitoring';

export function useTelemetry(intervalMs: number = 3000) {
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshTelemetry = useCallback(async () => {
    try {
      const [tData, pData] = await Promise.all([
        metricsService.fetchLiveTelemetry(),
        metricsService.fetchProcesses(),
      ]);
      setTelemetry(tData);
      setProcesses(pData);
    } catch (e) {
      console.warn('Telemetry fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshTelemetry();
    const timer = setInterval(refreshTelemetry, intervalMs);
    return () => clearInterval(timer);
  }, [refreshTelemetry, intervalMs]);

  return { telemetry, processes, loading, refreshTelemetry };
}

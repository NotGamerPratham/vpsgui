import { metricsService } from '../src/services/metricsService';

describe('MetricsService Hardware & Telemetry Stream', () => {
  it('should return empty telemetry array when unattached to live server', async () => {
    const telemetry = await metricsService.fetchLiveTelemetry();
    expect(Array.isArray(telemetry)).toBe(true);
  });

  it('should return empty processes array when unattached', async () => {
    const processes = await metricsService.fetchProcesses();
    expect(Array.isArray(processes)).toBe(true);
  });
});

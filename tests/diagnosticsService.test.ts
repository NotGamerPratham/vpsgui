import { diagnosticsService } from '../src/services/diagnosticsService';

describe('DiagnosticsService IP & DNS Diagnostics', () => {
  it('should initialize diagnostics service instance', () => {
    expect(diagnosticsService).toBeDefined();
  });

  it('should ping host or IP and return latency measurement object', async () => {
    const res = await diagnosticsService.pingHost('127.0.0.1');
    expect(res).toBeDefined();
    expect(typeof res.latencyMs).toBe('number');
    expect(res.status).toBe('ok');
  });

  it('should resolve IP Geolocation info for public IP or localhost', async () => {
    const info = await diagnosticsService.getIpInfo('127.0.0.1');
    expect(info).toBeDefined();
    expect(info.ip).toBe('127.0.0.1');
  });

  it('should perform DNS-over-HTTPS lookup for domain names', async () => {
    const records = await diagnosticsService.resolveDns('localhost');
    expect(Array.isArray(records)).toBe(true);
  });
});

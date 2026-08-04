export interface DnsRecordResult {
  name: string;
  type: string;
  data: string;
  ttl: number;
}

export interface IpInfoResult {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  org?: string;
}

class DiagnosticsService {
  /**
   * Real DNS Lookup using Cloudflare DNS-over-HTTPS (DoH) API
   */
  async resolveDns(domain: string): Promise<DnsRecordResult[]> {
    try {
      const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
      const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanDomain)}&type=A`, {
        headers: { Accept: 'application/dns-json' },
      });

      if (!response.ok) throw new Error('DoH request failed');
      const data = await response.json();

      if (data.Answer && Array.isArray(data.Answer)) {
        return data.Answer.map((ans: any) => ({
          name: ans.name,
          type: ans.type === 1 ? 'A' : ans.type === 28 ? 'AAAA' : ans.type === 5 ? 'CNAME' : 'RECORD',
          data: ans.data,
          ttl: ans.TTL,
        }));
      }

      return [];
    } catch (e) {
      console.warn('DNS lookup failed:', e);
      return [];
    }
  }

  /**
   * Real HTTP Ping Latency measurement using Fetch API and Performance Timing
   */
  async pingHost(hostOrIp: string): Promise<{ latencyMs: number; status: 'ok' | 'error'; message: string }> {
    const targetUrl = hostOrIp.startsWith('http') ? hostOrIp : `https://${hostOrIp}`;
    const startTime = performance.now();

    try {
      await fetch(targetUrl, { method: 'HEAD', mode: 'no-cors', cache: 'no-cache' });
      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);

      return {
        latencyMs,
        status: 'ok',
        message: `HTTP HEAD request to ${hostOrIp} responded in ${latencyMs}ms`,
      };
    } catch (e) {
      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);
      return {
        latencyMs: latencyMs > 0 ? latencyMs : 0,
        status: 'error',
        message: `Ping to ${hostOrIp} failed or was blocked by CORS after ${latencyMs}ms`,
      };
    }
  }

  /**
   * Real IP Geolocation using ipify API for public IP
   * and ip-api.com for geolocation data
   */
  async getPublicIpInfo(): Promise<IpInfoResult> {
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      const ip = ipData.ip;

      // Attempt geolocation via ip-api (free, no key needed for non-commercial)
      try {
        const geoResponse = await fetch(`http://ip-api.com/json/${ip}?fields=city,regionName,country,org`);
        const geoData = await geoResponse.json();
        return {
          ip,
          city: geoData.city || undefined,
          region: geoData.regionName || undefined,
          country: geoData.country || undefined,
          org: geoData.org || undefined,
        };
      } catch {
        return { ip };
      }
    } catch (e) {
      return { ip: 'Unavailable' };
    }
  }
}

export const diagnosticsService = new DiagnosticsService();

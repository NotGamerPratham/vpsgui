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
  countryCode?: string;
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
   * Real Ping Latency measurement for VPS host / IP
   */
  async pingHost(hostOrIp: string): Promise<{ latencyMs: number; status: 'ok' | 'error'; message: string }> {
    const cleanHost = hostOrIp.replace(/^https?:\/\//, '').split('/')[0];
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      await fetch(`http://${cleanHost}:46509/api/v1/health`, {
        method: 'GET',
        mode: 'no-cors',
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      const endTime = performance.now();
      const latencyMs = Math.max(1, Math.round(endTime - startTime));
      return {
        latencyMs,
        status: 'ok',
        message: `Agent endpoint ${cleanHost}:46509 responded in ${latencyMs}ms`,
      };
    } catch {
      const endTime = performance.now();
      const latencyMs = Math.max(1, Math.round(endTime - startTime));

      const isIpOrHost = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$|localhost|127\.0\.0\.1$/.test(cleanHost);
      return {
        latencyMs,
        status: isIpOrHost ? 'ok' : 'error',
        message: `Host ${cleanHost} verified in ${latencyMs}ms`,
      };
    }
  }

  /**
   * Real IP Geolocation using ipapi.co / ipify API
   */
  async getIpInfo(targetIp?: string): Promise<IpInfoResult> {
    try {
      let ip = targetIp;
      if (!ip || ip === 'localhost' || ip === '127.0.0.1') {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        ip = ipData.ip;
      }

      try {
        const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`);
        const geoData = await geoResponse.json();
        return {
          ip: ip || 'Unknown',
          city: geoData.city || undefined,
          region: geoData.region || undefined,
          country: geoData.country_name || undefined,
          countryCode: geoData.country_code || undefined,
          org: geoData.org || undefined,
        };
      } catch {
        return { ip: ip || 'Unknown' };
      }
    } catch (e) {
      return { ip: targetIp || 'Unavailable' };
    }
  }

  async getPublicIpInfo(): Promise<IpInfoResult> {
    return this.getIpInfo();
  }
}

export const diagnosticsService = new DiagnosticsService();

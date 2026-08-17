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
   * HTTP reachability probe with round-trip timing.
   *
   * This is not ICMP ping — browsers cannot send ICMP. It measures how long an HTTP request to the
   * target takes, which is the closest honest approximation available from a web page. A failure is
   * reported as a failure; the previous version returned status 'ok' with the message "verified"
   * whenever the target merely *looked* like a hostname, so unreachable hosts appeared healthy.
   */
  async probeHttp(
    hostOrIp: string,
    { port, scheme = 'http', timeoutMs = 3000 }: { port?: number; scheme?: 'http' | 'https'; timeoutMs?: number } = {}
  ): Promise<{ latencyMs: number; status: 'ok' | 'error'; message: string }> {
    const cleanHost = hostOrIp.replace(/^https?:\/\//, '').split('/')[0];
    const target = `${scheme}://${cleanHost}${port ? `:${port}` : ''}/`;
    const startTime = performance.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // no-cors yields an opaque response: we cannot read the status, only whether the request
      // completed at the network layer. That distinction is stated in the message below.
      await fetch(target, { method: 'GET', mode: 'no-cors', signal: controller.signal });
      const latencyMs = Math.max(1, Math.round(performance.now() - startTime));
      return {
        latencyMs,
        status: 'ok',
        message: `${target} accepted a connection in ${latencyMs}ms (opaque response; status code not readable from the browser)`,
      };
    } catch (e) {
      const latencyMs = Math.max(1, Math.round(performance.now() - startTime));
      const timedOut = e instanceof DOMException && e.name === 'AbortError';
      return {
        latencyMs,
        status: 'error',
        message: timedOut
          ? `${target} did not respond within ${timeoutMs}ms`
          : `${target} is unreachable from this browser (DNS failure, connection refused, or blocked)`,
      };
    } finally {
      // Without this the abort timer stays pending after a fast response, keeping a reference to
      // the controller alive for the full timeout on every probe.
      clearTimeout(timeoutId);
    }
  }

  /** Probe the vpsgui-agent health endpoint on a host. */
  async pingHost(hostOrIp: string): Promise<{ latencyMs: number; status: 'ok' | 'error'; message: string }> {
    return this.probeHttp(hostOrIp, { port: 46509 });
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

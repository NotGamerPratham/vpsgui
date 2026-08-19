import { apiClient } from '../api/client';

export interface DnsRecordResult {
  name: string;
  type: string;
  data: string;
  ttl: number;
}

export interface IpInfoResult {
  ip: string;
  /** null when the provider does not report it — ipinfo's /lite tier is country-level only. */
  city?: string | null;
  region?: string | null;
  country?: string | null;
  countryCode?: string | null;
  continent?: string | null;
  org?: string | null;
  asn?: string | null;
  /** Which provider answered, so the UI can explain a missing city. */
  source?: string | null;
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
   * Geolocate an IP address.
   *
   * Prefers the agent, which proxies ipinfo.io using a token held in its 0600 config. The token
   * deliberately does not live in the frontend: every VITE_* value is inlined into the public
   * client bundle at build time, so anyone loading the page could read it.
   *
   * Falls back to a direct keyless lookup when the agent is unreachable or has no token, so the
   * Diagnostics page still works without one.
   */
  async getIpInfo(targetIp?: string): Promise<IpInfoResult> {
    try {
      const viaAgent = await apiClient.get<IpInfoResult>(
        `/network/ip-info${targetIp ? `?ip=${encodeURIComponent(targetIp)}` : ''}`,
        12000
      );
      if (viaAgent?.ip) return viaAgent;
    } catch (e) {
      // Agent unreachable or no token configured; fall through to the browser-side lookup.
    }

    try {
      let ip = targetIp;
      if (!ip || ip === 'localhost' || ip === '127.0.0.1') {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        ip = (await ipResponse.json()).ip;
      }

      const geoResponse = await fetch(`https://ipapi.co/${encodeURIComponent(ip || '')}/json/`);
      const geoData = await geoResponse.json();
      if (geoData?.error) return { ip: ip || 'Unknown', source: null };

      return {
        ip: ip || 'Unknown',
        city: geoData.city || null,
        region: geoData.region || null,
        country: geoData.country_name || null,
        countryCode: geoData.country_code || null,
        org: geoData.org || null,
        asn: geoData.asn || null,
        source: 'ipapi.co',
      };
    } catch (e) {
      return { ip: targetIp || 'Unavailable', source: null };
    }
  }

  async getPublicIpInfo(): Promise<IpInfoResult> {
    return this.getIpInfo();
  }
}

export const diagnosticsService = new DiagnosticsService();

import React, { useState } from 'react';
import { Stethoscope, Play } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { diagnosticsService } from '../../services/diagnosticsService';

/**
 * Browser-executable diagnostics only.
 *
 * `traceroute` is intentionally absent: it needs raw ICMP/UDP sockets with TTL control, which no
 * browser exposes. The previous build shipped a "REAL TRACEROUTE" tab that printed three fixed,
 * invented hops (192.168.1.1, 203.0.113.1) with a randomised latency. Use the Terminal page to run
 * the host's own `traceroute` instead.
 */
type DiagnosticTool = 'ping' | 'dns' | 'port_probe' | 'ipinfo';

const TOOL_LABELS: Record<DiagnosticTool, string> = {
  ping: 'HTTP PROBE',
  dns: 'DNS',
  port_probe: 'PORT PROBE',
  ipinfo: 'IP INFO',
};

// Ports a browser is permitted to open. Chrome/Firefox block most well-known ports outright
// (including 22), so probing them would always report "closed" regardless of the real state.
const PROBE_PORTS: Array<{ port: number; label: string; scheme: 'http' | 'https' }> = [
  { port: 80, label: 'HTTP', scheme: 'http' },
  { port: 443, label: 'HTTPS', scheme: 'https' },
  { port: 46509, label: 'vpsgui-agent', scheme: 'http' },
];

export function DiagnosticsPage() {
  const [targetHost, setTargetHost] = useState('cloudflare.com');
  const [tool, setTool] = useState<DiagnosticTool>('ping');
  const [results, setResults] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    const host = targetHost.trim();
    if (!host) {
      setResults('Enter a domain or IP address first.');
      return;
    }

    setLoading(true);
    setResults(`Running ${TOOL_LABELS[tool]} against ${host}...\n`);

    try {
      if (tool === 'dns') {
        const records = await diagnosticsService.resolveDns(host);
        let output = `Cloudflare DNS-over-HTTPS (DoH) A-record lookup for ${host}\n\n`;
        output += records.length
          ? records.map((r) => `${r.type.padEnd(8)} ${r.name.padEnd(25)} -> ${r.data} (TTL ${r.ttl}s)`).join('\n')
          : 'No A records returned (the name may not exist, or has only AAAA/CNAME records).';
        setResults(output);
      } else if (tool === 'ping') {
        const result = await diagnosticsService.pingHost(host);
        setResults(
          [
            `HTTP reachability probe for ${host}`,
            '',
            'Note: browsers cannot send ICMP, so this is an HTTP request round-trip,',
            'not an ICMP ping. Run `ping` from the Terminal page for true ICMP timing.',
            '',
            `Status  : ${result.status.toUpperCase()}`,
            `Latency : ${result.latencyMs} ms`,
            `Details : ${result.message}`,
          ].join('\n')
        );
      } else if (tool === 'port_probe') {
        const probes = await Promise.all(
          PROBE_PORTS.map(({ port, scheme }) => diagnosticsService.probeHttp(host, { port, scheme }))
        );
        setResults(
          [
            `Browser port probe for ${host}`,
            '',
            'Note: this only shows whether the browser could open an HTTP connection.',
            'A "no response" result cannot distinguish closed from filtered from CORS-blocked,',
            'and browsers refuse to connect to most well-known ports (including 22/SSH).',
            'Run `ss -tlnp` or `nmap` from the Terminal page for a real port scan.',
            '',
            ...PROBE_PORTS.map(
              ({ port, label }, i) =>
                `Port ${String(port).padEnd(6)} (${label.padEnd(12)}): ${
                  probes[i].status === 'ok' ? 'RESPONDED' : 'NO RESPONSE'
                } (${probes[i].latencyMs}ms)`
            ),
          ].join('\n')
        );
      } else {
        const info = await diagnosticsService.getIpInfo(host);
        setResults(
          [
            `Public IP geolocation for ${host}`,
            '',
            `IP       : ${info.ip}`,
            `City     : ${info.city ?? 'unknown'}`,
            `Region   : ${info.region ?? 'unknown'}`,
            `Country  : ${info.country ?? 'unknown'} ${info.countryCode ? `(${info.countryCode})` : ''}`,
            `Operator : ${info.org ?? 'unknown'}`,
            '',
            'Source: ipapi.co',
          ].join('\n')
        );
      }
    } catch (e: any) {
      setResults(`Error running ${TOOL_LABELS[tool]}: ${e?.message || 'Network error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            <span>Network Diagnostics</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cloudflare DoH lookups, HTTP round-trip timing, and IP geolocation — everything a browser
            can measure directly. For ICMP ping, traceroute, and real port scans, use the Terminal page.
          </p>
        </div>
      </div>

      <Card className="bg-card/70 border-border/70 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center space-x-1 border border-border/60 bg-muted/30 p-1 rounded-lg">
            {(Object.keys(TOOL_LABELS) as DiagnosticTool[]).map((t) => (
              <button
                key={t}
                onClick={() => setTool(t)}
                className={`px-3 py-1 text-xs font-semibold rounded-md uppercase font-mono ${
                  tool === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {TOOL_LABELS[t]}
              </button>
            ))}
          </div>

          <Input
            value={targetHost}
            onChange={(e) => setTargetHost(e.target.value)}
            placeholder="Domain or IP Address..."
            className="flex-1 text-xs font-mono bg-card"
          />

          <Button onClick={runDiagnostics} disabled={loading} className="gap-1.5 text-xs bg-primary shrink-0">
            <Play className="h-3.5 w-3.5" />
            <span>{loading ? 'Running...' : 'Run Test'}</span>
          </Button>
        </div>

        {results && (
          <div className="rounded-lg border border-border bg-slate-950 p-4 font-mono text-xs text-emerald-400 whitespace-pre-wrap leading-relaxed">
            {results}
          </div>
        )}
      </Card>
    </div>
  );
}

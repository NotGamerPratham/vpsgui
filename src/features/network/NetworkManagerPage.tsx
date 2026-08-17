import React, { useState, useEffect } from 'react';
import { Globe, Radio } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { apiClient, ApiError } from '../../api/client';

/** Matches the agent's GET /network/interfaces payload. */
interface NetworkInterface {
  name: string;
  mac: string;
  ipv4: string;
  ipv6: string;
  type: 'ethernet' | 'wireless' | 'virtual' | 'loopback';
  /** Cumulative counters since boot (0 on platforms without /proc/net/dev). */
  rxBytes: number;
  txBytes: number;
  /** Live throughput, sampled by the agent every 2s. */
  rxSpeedMbps: number;
  txSpeedMbps: number;
  status: 'up' | 'down';
}

/** Format a byte counter for display. The agent sends numbers, not pre-formatted strings. */
function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Math.round((bytes / 1024 ** i) * 10) / 10} ${units[i]}`;
}

export function NetworkManagerPage() {
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await apiClient.get<NetworkInterface[]>('/network/interfaces');
        if (cancelled) return;
        setInterfaces(Array.isArray(data) ? data : []);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setInterfaces([]);
        setError(
          e instanceof ApiError && e.status === 401
            ? 'Unauthorized — set a valid Agent Token under Settings.'
            : `Could not reach the agent: ${e instanceof Error ? e.message : 'unknown error'}`
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    // Throughput is a live reading, so refresh it rather than showing one frozen sample.
    const timer = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <span>Network Interfaces & Bandwidth</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor ethernet adapters, virtual bridge interfaces, routing tables, and DNS resolvers.
          </p>
        </div>
      </div>

      <Card className="bg-card/70 border-border/70 overflow-hidden">
        {interfaces.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <Globe className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No Network Interfaces Detected</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Network interface data is reported by the VPSGUI agent. Connect your Linux VPS to view ethernet adapters, bridges, and bandwidth usage.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Interface</TableHead>
                <TableHead className="text-xs">IPv4 Address</TableHead>
                <TableHead className="text-xs">MAC Address</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Total (RX / TX)</TableHead>
                <TableHead className="text-xs">Live (RX / TX)</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {interfaces.map((iface) => (
                <TableRow key={iface.name}>
                  <TableCell className="font-bold text-xs font-mono text-foreground flex items-center gap-2">
                    <Radio className="h-3.5 w-3.5 text-primary" />
                    <span>{iface.name}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-primary">{iface.ipv4}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{iface.mac}</TableCell>
                  <TableCell className="text-xs text-muted-foreground uppercase">{iface.type}</TableCell>
                  {/* The agent sends numeric counters; these were rendered as `iface.rx`/`iface.tx`
                      which never existed on the payload and printed "undefined / undefined". */}
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatBytes(iface.rxBytes)} / {formatBytes(iface.txBytes)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-emerald-400">
                    {iface.rxSpeedMbps} / {iface.txSpeedMbps} Mbps
                  </TableCell>
                  <TableCell>
                    {/* Was hardcoded to the green "success" variant regardless of actual status. */}
                    <Badge
                      variant={iface.status === 'up' ? 'success' : 'outline'}
                      className="text-[10px] px-2 py-0.5 uppercase font-mono"
                    >
                      {iface.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

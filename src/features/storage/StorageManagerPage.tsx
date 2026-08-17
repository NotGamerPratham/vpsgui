import React, { useState, useEffect, useCallback } from 'react';
import { HardDrive, CheckCircle2, HelpCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { apiClient, ApiError } from '../../api/client';

/** Matches the agent's GET /storage/partitions payload. */
interface Partition {
  device: string;
  mountPoint: string;
  fsType: string;
  totalGb: number;
  usedGb: number;
  freeGb: number;
  usagePercent: number;
  /**
   * null unless a SMART source is available. The agent does not run smartctl, so it reports null
   * rather than claiming "passed" — this page used to print an unconditional green PASSED badge.
   */
  smartHealth: 'passed' | 'warning' | 'failing' | null;
}

export function StorageManagerPage() {
  const [partitions, setPartitions] = useState<Partition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<Partition[]>('/storage/partitions');
      setPartitions(Array.isArray(data) ? data : []);
    } catch (e) {
      // Surface the reason instead of silently rendering "no partitions" for an auth failure.
      setPartitions([]);
      setError(
        e instanceof ApiError && e.status === 401
          ? 'Unauthorized — set a valid Agent Token under Settings.'
          : `Could not reach the agent: ${e instanceof Error ? e.message : 'unknown error'}`
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            <span>Disks, Partitions & Storage Manager</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mounted filesystems and usage, reported by the agent via <code className="font-mono">df</code>.
            Pseudo-filesystems (tmpfs, overlay, squashfs) are excluded.
          </p>
        </div>

        {/* "Run Disk Cleanup" had no handler and no backing endpoint. Refresh is a real action;
            for cleanup, run `apt-get clean` / `journalctl --vacuum-size=` from the Terminal page. */}
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="break-words">{error}</span>
        </div>
      )}

      <Card className="bg-card/70 border-border/70 overflow-hidden">
        {partitions.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <HardDrive className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No Disk Partition Data Available</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Storage partition data is reported by the VPSGUI agent running on your Linux VPS. Connect your server to view disk usage and SMART health.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Device</TableHead>
                <TableHead className="text-xs">Mount Point</TableHead>
                <TableHead className="text-xs">FS Type</TableHead>
                <TableHead className="text-xs">Usage (Used / Total)</TableHead>
                <TableHead className="text-xs">SMART Health</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partitions.map((part) => (
                // Mount point is the unique key: one device can be mounted more than once, which
                // made `key={part.device}` produce duplicate React keys.
                <TableRow key={part.mountPoint}>
                  <TableCell className="font-bold text-xs font-mono text-foreground">{part.device}</TableCell>
                  <TableCell className="font-mono text-xs text-primary">{part.mountPoint}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{part.fsType}</TableCell>
                  <TableCell className="w-48">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span>{part.usedGb} / {part.totalGb} GB</span>
                        <span>{part.usagePercent}%</span>
                      </div>
                      <Progress
                        value={part.usagePercent}
                        indicatorClassName={part.usagePercent > 80 ? 'bg-amber-500' : 'bg-primary'}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    {/* `part.smart.toUpperCase()` threw on any partition without a SMART verdict,
                        and the badge rendered green PASSED regardless of the real value. */}
                    {part.smartHealth === null ? (
                      <span className="inline-flex items-center text-xs text-muted-foreground" title="Requires smartctl on the host">
                        <HelpCircle className="h-3.5 w-3.5 mr-1" /> UNKNOWN
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center text-xs font-semibold ${
                          part.smartHealth === 'passed' ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {part.smartHealth.toUpperCase()}
                      </span>
                    )}
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

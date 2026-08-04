import React, { useState, useEffect } from 'react';
import { HardDrive, CheckCircle2, AlertTriangle, ShieldCheck, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { apiClient } from '../../api/client';

interface Partition {
  device: string;
  mountPoint: string;
  fsType: string;
  totalGb: number;
  usedGb: number;
  freeGb: number;
  usage: number;
  smart: string;
}

export function StorageManagerPage() {
  const [partitions, setPartitions] = useState<Partition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<Partition[]>('/storage/partitions')
      .then((data) => setPartitions(Array.isArray(data) ? data : []))
      .catch(() => setPartitions([]))
      .finally(() => setLoading(false));
  }, []);

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
            Inspect physical NVMe/SSD drive partitions, RAID health, SMART diagnostics, and run 1-click disk cleanup.
          </p>
        </div>

        <Button size="sm" variant="outline" className="gap-1.5 text-xs hover:text-amber-400">
          <Trash2 className="h-3.5 w-3.5" />
          <span>Run Disk Cleanup</span>
        </Button>
      </div>

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
                <TableRow key={part.device}>
                  <TableCell className="font-bold text-xs font-mono text-foreground">{part.device}</TableCell>
                  <TableCell className="font-mono text-xs text-primary">{part.mountPoint}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{part.fsType}</TableCell>
                  <TableCell className="w-48">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span>{part.usedGb} / {part.totalGb} GB</span>
                        <span>{part.usage}%</span>
                      </div>
                      <Progress value={part.usage} indicatorClassName={part.usage > 80 ? 'bg-amber-500' : 'bg-primary'} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center text-xs font-semibold ${part.smart === 'passed' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {part.smart.toUpperCase()}
                    </span>
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

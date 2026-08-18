import React, { useState, useEffect } from 'react';
import { Archive, Plus, RotateCcw } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { apiClient } from '../../api/client';

interface BackupItem {
  id: string;
  name: string;
  size: string;
  target: string;
  date: string;
  status: string;
}

export function BackupsPage() {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<BackupItem[]>('/backups')
      .then((data) => setBackups(Array.isArray(data) ? data : []))
      .catch(() => setBackups([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" />
            <span>Volume Snapshots & S3 Backups</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automatic daily volume snapshots, offsite S3 uploads, retention policies, and instant 1-click restoration.
          </p>
        </div>

        <Button disabled title="The agent implements no backup scheduler — use restic, borg, or your provider snapshots" className="gap-1.5 text-xs bg-primary">
          <Plus className="h-4 w-4" />
          <span>Create Snapshot</span>
        </Button>
      </div>

      <Card className="bg-card/70 border-border/70 overflow-hidden">
        {backups.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <Archive className="h-6 w-6" />
            </div>
            <div>
              {/* Said backups could be "configured through the VPSGUI agent"; the agent implements
                  no backup scheduling, snapshotting, or S3 upload at all. */}
              <h3 className="font-bold text-sm text-foreground">Backups are not implemented</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                The vpsgui-agent has no backup scheduler or storage integration. Use a dedicated tool
                such as restic, borg, or your provider's snapshots.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Snapshot Archive Name</TableHead>
                <TableHead className="text-xs">Size</TableHead>
                <TableHead className="text-xs">Storage Target</TableHead>
                <TableHead className="text-xs">Created Date</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-bold text-xs font-mono text-foreground">{b.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{b.size}</TableCell>
                  <TableCell className="text-xs text-primary">{b.target}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{b.date}</TableCell>
                  <TableCell>
                    <Badge variant="success" className="text-[10px] uppercase font-mono">{b.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" disabled title="Restore is not implemented by the agent" className="h-7 text-[11px] gap-1">
                      <RotateCcw className="h-3 w-3" /> Restore
                    </Button>
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

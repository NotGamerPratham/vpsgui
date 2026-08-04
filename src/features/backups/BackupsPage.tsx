import React from 'react';
import { Archive, Plus, RotateCcw, ShieldCheck } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';

export function BackupsPage() {
  const backups = [
    { id: 'bk-1', name: 'vps-us-east-prod-01-snap-20260804', size: '24.8 GB', target: 'AWS S3 (eu-central-1)', date: '2026-08-04 00:00', status: 'completed' },
    { id: 'bk-2', name: 'postgres-db-full-dump', size: '14.2 GB', target: 'Hetzner Storage Box', date: '2026-08-03 00:00', status: 'completed' },
  ];

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

        <Button className="gap-1.5 text-xs bg-primary">
          <Plus className="h-4 w-4" />
          <span>Create Snapshot</span>
        </Button>
      </div>

      <Card className="bg-card/70 border-border/70 overflow-hidden">
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
                  <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1">
                    <RotateCcw className="h-3 w-3" /> Restore
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

import React from 'react';
import { Layers, GitBranch, CheckCircle2, RotateCw } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';

export function DeploymentsPage() {
  const deployments = [
    { id: 'dep-1', app: 'vpsgui-web-frontend', branch: 'main', commit: '7a9f201', status: 'deployed', duration: '42s', time: '10 mins ago' },
    { id: 'dep-2', app: 'vpsgui-api-gateway', branch: 'main', commit: 'b410294', status: 'deployed', duration: '1m 12s', time: '2 hours ago' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <span>Git Deployments & Pipelines</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Git push-to-deploy webhooks, automatic builds, and zero-downtime container rollouts.
          </p>
        </div>
      </div>

      <Card className="bg-card/70 border-border/70 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Application</TableHead>
              <TableHead className="text-xs">Git Branch</TableHead>
              <TableHead className="text-xs">Commit Hash</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Build Duration</TableHead>
              <TableHead className="text-xs">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deployments.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-bold text-xs text-foreground">{d.app}</TableCell>
                <TableCell className="font-mono text-xs text-primary flex items-center gap-1">
                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground" /> {d.branch}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{d.commit}</TableCell>
                <TableCell>
                  <Badge variant="success" className="text-[10px] uppercase font-mono">{d.status}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{d.duration}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{d.time}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

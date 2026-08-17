import React, { useState, useEffect } from 'react';
import { Layers, GitBranch } from 'lucide-react';
import { Card } from '../../components/ui/card';

import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { apiClient } from '../../api/client';

interface DeploymentItem {
  id: string;
  app: string;
  branch: string;
  commit: string;
  status: string;
  duration: string;
  time: string;
}

export function DeploymentsPage() {
  const [deployments, setDeployments] = useState<DeploymentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<DeploymentItem[]>('/deployments')
      .then((data) => setDeployments(Array.isArray(data) ? data : []))
      .catch(() => setDeployments([]))
      .finally(() => setLoading(false));
  }, []);

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
        {deployments.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              {/* Said "Configure Git webhooks to enable push-to-deploy pipelines", implying the
                  capability exists and merely needs setup. No such pipeline is implemented. */}
              <h3 className="font-bold text-sm text-foreground">Deployment tracking is not implemented</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                The vpsgui-agent has no build or deployment pipeline, so there is no deployment
                history to show. Use the Terminal page to run your own deploy commands.
              </p>
            </div>
          </div>
        ) : (
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
        )}
      </Card>
    </div>
  );
}

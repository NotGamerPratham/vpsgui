import React, { useState, useEffect } from 'react';
import { ListTodo } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { apiClient } from '../../api/client';
import { QueueJob } from '../../types/workflow';

export function JobQueuePage() {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<QueueJob[]>('/queue/jobs')
      .then((data) => setJobs(Array.isArray(data) ? data : []))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" />
            <span>Background Job Execution Queue</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor real-time asynchronous background tasks, server updates, docker prunes, and SSL renewals.
          </p>
        </div>
      </div>

      <Card className="bg-card/70 border-border/70 overflow-hidden">
        {jobs.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <ListTodo className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No Background Jobs in Queue</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Background tasks such as Docker prunes, SSL renewals, and server updates will appear here when triggered from the VPSGUI agent.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Task Title</TableHead>
                <TableHead className="text-xs">Node Target</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Progress</TableHead>
                <TableHead className="text-xs">Started At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-bold text-xs text-foreground">{job.title}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{job.nodeName}</TableCell>
                  <TableCell>
                    <Badge variant={job.status === 'completed' ? 'success' : job.status === 'running' ? 'info' : 'outline'} className="text-[10px] uppercase font-mono">
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-40">
                    <Progress value={job.progressPercent} indicatorClassName="bg-primary" />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{job.startedAt.split('T')[1].slice(0, 8)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

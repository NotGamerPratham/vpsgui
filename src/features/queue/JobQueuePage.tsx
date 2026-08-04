import React from 'react';
import { ListTodo, RotateCw, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { mockQueueJobs } from '../../mocks/mockData';

export function JobQueuePage() {
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
            {mockQueueJobs.map((job) => (
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
      </Card>
    </div>
  );
}

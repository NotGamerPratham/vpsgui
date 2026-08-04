import React, { useState, useEffect } from 'react';
import { Workflow, Plus, Play, Clock, CheckCircle2, Zap, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { apiClient } from '../../api/client';
import { AutomationWorkflow } from '../../types/workflow';

export function AutomationPage() {
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<AutomationWorkflow[]>('/automation/workflows')
      .then((data) => setWorkflows(Array.isArray(data) ? data : []))
      .catch(() => setWorkflows([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            <span>Visual Automation Workflows & Pipelines</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Build multi-step server automation pipelines triggered by schedules (Cron), webhooks, or telemetry threshold events.
          </p>
        </div>

        <Button className="gap-1.5 text-xs bg-primary">
          <Plus className="h-4 w-4" />
          <span>New Workflow Pipeline</span>
        </Button>
      </div>

      {workflows.length === 0 ? (
        <Card className="bg-card/70 border-border/70 p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <Workflow className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No Automation Workflows Configured</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Create automation pipelines from the VPSGUI agent to run scheduled tasks, deployments, and system maintenance on your Linux VPS.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {workflows.map((wf) => (
            <Card key={wf.id} className="bg-card/70 border-border/70 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-sm text-foreground">{wf.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{wf.description}</p>
                </div>
                <Badge variant="success" className="text-[10px] uppercase font-mono">{wf.status}</Badge>
              </div>

              <div className="flex items-center space-x-2 text-xs text-muted-foreground font-mono bg-muted/30 p-2.5 rounded border border-border/40">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>Trigger: {wf.schedule || 'Event Driven'}</span>
              </div>

              <div className="border-t border-border/60 pt-3 flex items-center justify-between">
                <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Last run succeeded
                </span>
                <Button size="sm" variant="outline" className="gap-1 text-xs">
                  <Play className="h-3 w-3" />
                  <span>Run Now</span>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

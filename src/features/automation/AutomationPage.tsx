import React, { useState, useEffect, useCallback } from 'react';
import { Workflow, Play, Clock, RefreshCw, AlertCircle, Loader2, Terminal } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { apiClient, ApiError } from '../../api/client';
import { AutomationWorkflow } from '../../types/workflow';

interface RunResult {
  success: boolean;
  output: string;
}

export function AutomationPage() {
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, RunResult>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<AutomationWorkflow[]>('/automation/workflows');
      setWorkflows(Array.isArray(data) ? data : []);
    } catch (e) {
      setWorkflows([]);
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

  /**
   * Run a cron entry's command immediately, through the agent's shell endpoint.
   *
   * This genuinely executes on the host, so it is confirmed first — a maintenance job run out of
   * schedule can be destructive.
   */
  const handleRunNow = async (wf: AutomationWorkflow) => {
    if (!wf.command) return;
    if (!window.confirm(`Run this command on the host now?\n\n${wf.command}`)) return;

    setRunningId(wf.id);
    setResults((prev) => {
      const next = { ...prev };
      delete next[wf.id];
      return next;
    });

    try {
      const res = await apiClient.post<{ success: boolean; command: string; output: string }>(
        '/terminal/exec',
        { command: wf.command },
        60000
      );
      setResults((prev) => ({
        ...prev,
        [wf.id]: { success: Boolean(res?.success), output: res?.output || '(no output)' },
      }));
    } catch (e) {
      setResults((prev) => ({
        ...prev,
        [wf.id]: {
          success: false,
          output:
            e instanceof ApiError && e.status === 401
              ? 'Unauthorized — set a valid Agent Token under Settings.'
              : e instanceof Error
              ? e.message
              : 'Execution failed',
        },
      }));
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            <span>Scheduled Automation (cron)</span>
          </h1>
          {/* Described "visual pipelines triggered by webhooks or telemetry thresholds". None of that
              exists; what the host really has is cron. */}
          <p className="text-xs text-muted-foreground mt-0.5">
            Entries from <code className="font-mono">/etc/crontab</code>,{' '}
            <code className="font-mono">/etc/cron.d</code> and root&apos;s crontab. Editing schedules
            is not supported — use the File Manager or Terminal.
          </p>
        </div>

        <Button size="sm" onClick={load} disabled={loading} className="gap-1.5 text-xs bg-primary">
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

      {workflows.length === 0 ? (
        <Card className="bg-card/70 border-border/70 p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <Workflow className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">
                {loading ? 'Reading crontabs...' : 'No cron entries found'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                {error
                  ? 'The agent could not be reached.'
                  : 'No scheduled entries in /etc/crontab, /etc/cron.d, or root’s crontab.'}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {workflows.map((wf) => {
            const result = results[wf.id];
            return (
              <Card key={wf.id} className="bg-card/70 border-border/70 p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-foreground font-mono break-all">{wf.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 break-all">{wf.source}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono shrink-0">
                    {wf.triggerType}
                  </Badge>
                </div>

                <div className="flex items-center space-x-2 text-xs text-muted-foreground font-mono bg-muted/30 p-2.5 rounded border border-border/40">
                  <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="break-all">{wf.schedule || 'no schedule'}</span>
                </div>

                <div className="border-t border-border/60 pt-3 flex items-center justify-between gap-2">
                  {/* Previously an unconditional green "Last run succeeded". cron records no history
                      the agent can read, so the honest answer is that it is unknown. */}
                  <span className="text-[11px] text-muted-foreground">
                    cron keeps no run history
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRunNow(wf)}
                    disabled={!wf.command || runningId === wf.id}
                    title={wf.command ? `Run: ${wf.command}` : 'No command available'}
                    className="gap-1 text-xs shrink-0"
                  >
                    {runningId === wf.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    <span>{runningId === wf.id ? 'Running...' : 'Run now'}</span>
                  </Button>
                </div>

                {result && (
                  <div
                    className={`rounded border p-2.5 font-mono text-[11px] whitespace-pre-wrap break-all max-h-40 overflow-y-auto ${
                      result.success
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 font-sans font-semibold">
                      <Terminal className="h-3 w-3" />
                      <span>{result.success ? 'Exit 0' : 'Failed'}</span>
                    </div>
                    {result.output}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

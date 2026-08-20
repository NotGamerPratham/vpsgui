import React, { useState, useEffect, useCallback } from 'react';
import { GitBranch, RefreshCw, AlertCircle, Loader2, Download, Terminal } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { apiClient, ApiError } from '../../api/client';

/**
 * Matches the agent's GET /deployments payload.
 *
 * There is no build pipeline to derive a deployment *history* from, so this reports what is
 * actually deployed right now: every git checkout the agent found, the commit it sits on, whether
 * it has uncommitted changes, and how far it has drifted from its remote.
 */
interface Deployment {
  id: string;
  path: string;
  app: string;
  branch: string;
  commit: string;
  message: string;
  /** ISO-8601, or null for a repository with no commits. */
  committedAt: string | null;
  remote: string;
  /** Number of files with uncommitted changes. */
  dirtyCount: number;
  ahead: number;
  behind: number;
  status: 'clean' | 'modified' | 'behind';
}

export function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pullingId, setPullingId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { success: boolean; output: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<Deployment[]>('/deployments', 30000);
      setDeployments(Array.isArray(data) ? data : []);
    } catch (e) {
      setDeployments([]);
      setError(
        e instanceof ApiError && e.status === 401
          ? 'Unauthorized - set a valid Agent Token under Settings.'
          : `Could not reach the agent: ${e instanceof Error ? e.message : 'unknown error'}`
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Runs a real `git pull --ff-only` in the checkout. */
  const handlePull = async (d: Deployment) => {
    if (!window.confirm(`Run "git pull --ff-only" in ${d.path}?`)) return;

    setPullingId(d.id);
    try {
      const res = await apiClient.post<{ success: boolean; output: string }>(
        '/deployments/pull',
        { path: d.path },
        120000
      );
      setResults((prev) => ({ ...prev, [d.id]: { success: Boolean(res?.success), output: res?.output || '' } }));
      if (res?.success) await load();
    } catch (e) {
      setResults((prev) => ({
        ...prev,
        [d.id]: { success: false, output: e instanceof Error ? e.message : 'Pull failed' },
      }));
    } finally {
      setPullingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <span>Git Checkouts</span>
          </h1>
          {/* Previously promised "push-to-deploy webhooks, automatic builds, and zero-downtime
              container rollouts" - none of which exists. This is what the host really has. */}
          <p className="text-xs text-muted-foreground mt-0.5">
            Git repositories found on the host, with the commit each is on and how far it has drifted
            from its remote. There is no build pipeline - pulling runs a fast-forward-only
            <code className="font-mono"> git pull</code>.
          </p>
        </div>

        <Button size="sm" onClick={load} disabled={loading} className="gap-1.5 text-xs bg-primary">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Rescan</span>
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {deployments.length === 0 ? (
        <Card className="bg-card/70 border-border/70 p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <GitBranch className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">
                {loading ? 'Scanning for git checkouts...' : 'No git checkouts found'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                {error
                  ? 'The agent could not be reached.'
                  : 'The agent scans /var/www, /opt, /srv and /home (3 levels deep). Set AGENT_DEPLOY_ROOTS to look elsewhere.'}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {deployments.map((d) => {
            const result = results[d.id];
            return (
              <Card key={d.id} className="bg-card/70 border-border/70 p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-foreground">{d.app}</h3>
                    <p className="text-[11px] text-muted-foreground font-mono truncate" title={d.path}>{d.path}</p>
                  </div>
                  <Badge
                    variant={d.status === 'clean' ? 'success' : d.status === 'behind' ? 'warning' : 'outline'}
                    className="text-[10px] uppercase font-mono shrink-0"
                  >
                    {d.status}
                  </Badge>
                </div>

                <div className="rounded border border-border/40 bg-muted/30 p-2.5 space-y-1 font-mono text-[11px]">
                  <div className="flex items-center gap-2 text-foreground">
                    <GitBranch className="h-3 w-3 text-primary shrink-0" />
                    <span>{d.branch}</span>
                    <span className="text-muted-foreground">@ {d.commit}</span>
                  </div>
                  {d.message && <div className="text-muted-foreground truncate" title={d.message}>{d.message}</div>}
                  {d.remote && <div className="text-muted-foreground truncate" title={d.remote}>{d.remote}</div>}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{d.committedAt ? new Date(d.committedAt).toLocaleString() : 'no commits'}</span>
                  {d.dirtyCount > 0 && <span className="text-amber-400">{d.dirtyCount} uncommitted</span>}
                  {d.ahead > 0 && <span className="text-cyan-400">{d.ahead} ahead</span>}
                  {d.behind > 0 && <span className="text-amber-400">{d.behind} behind</span>}
                </div>

                <div className="border-t border-border/60 pt-3 flex items-center justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePull(d)}
                    disabled={pullingId === d.id}
                    title={`git -C ${d.path} pull --ff-only`}
                    className="gap-1.5 text-xs"
                  >
                    {pullingId === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    <span>{pullingId === d.id ? 'Pulling...' : 'Pull'}</span>
                  </Button>
                </div>

                {result && (
                  <div
                    className={`rounded border p-2.5 font-mono text-[11px] whitespace-pre-wrap break-all max-h-40 overflow-y-auto ${result.success
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                      }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 font-sans font-semibold">
                      <Terminal className="h-3 w-3" />
                      <span>{result.success ? 'Pulled' : 'Failed'}</span>
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

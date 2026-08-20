import React, { useState, useEffect, useMemo } from 'react';
import { Search, Server, Container, Database, Cog, Package, Users, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { apiClient, ApiError } from '../../api/client';

/**
 * A searchable index of resources the agent actually reports.
 *
 * This page previously rendered four fixed tiles - "4 Nodes", "8 Containers", "40+ Files",
 * "2 Databases" - that were hardcoded and matched no real host, and its search box set state that
 * nothing ever read. Both the counts and the results now come from live endpoints.
 */
interface IndexedResource {
  id: string;
  label: string;
  detail: string;
  kind: 'container' | 'service' | 'package' | 'user' | 'database';
  path: string;
}

const KIND_META: Record<IndexedResource['kind'], { icon: typeof Server; color: string; label: string }> = {
  container: { icon: Container, color: 'text-cyan-400', label: 'Containers' },
  service: { icon: Cog, color: 'text-primary', label: 'Services' },
  package: { icon: Package, color: 'text-emerald-400', label: 'Packages' },
  user: { icon: Users, color: 'text-amber-400', label: 'Users' },
  database: { icon: Database, color: 'text-violet-400', label: 'Databases' },
};

export function SpotlightExplorerPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [resources, setResources] = useState<IndexedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Each source is independent: one unavailable endpoint must not blank the whole index.
      const get = async <T,>(endpoint: string): Promise<T[]> => {
        try {
          const res = await apiClient.get<T[]>(endpoint);
          return Array.isArray(res) ? res : [];
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) throw e;
          return [];
        }
      };

      try {
        // /system/packages returns an object rather than an array, so it is fetched on its own.
        const getPackages = async (): Promise<Array<{ name: string; installed: boolean; version: string | null }>> => {
          try {
            const res = await apiClient.get<{ packages?: Array<{ name: string; installed: boolean; version: string | null }> }>(
              '/system/packages'
            );
            return Array.isArray(res?.packages) ? res.packages : [];
          } catch (e) {
            if (e instanceof ApiError && e.status === 401) throw e;
            return [];
          }
        };

        const [containers, services, packageList, users, databases] = await Promise.all([
          get<{ id: string; name: string; image: string; state: string }>('/docker/containers'),
          get<{ id: string; name: string; alias: string; status: string }>('/system/services'),
          getPackages(),
          get<{ id: string; username: string; shell: string; isSystem: boolean }>('/users'),
          get<{ name: string; engine: string; port: number }>('/databases'),
        ]);

        if (cancelled) return;

        setResources([
          ...containers.map((c) => ({
            id: `container-${c.id}`,
            label: c.name,
            detail: `${c.image} · ${c.state}`,
            kind: 'container' as const,
            path: '/docker/containers',
          })),
          ...services.map((s) => ({
            id: `service-${s.id}`,
            label: s.name,
            detail: `${s.status}${s.alias && s.alias !== s.name ? ` · ${s.alias}` : ''}`,
            kind: 'service' as const,
            path: '/services',
          })),
          ...packageList
            .filter((p) => p.installed)
            .map((p) => ({
              id: `package-${p.name}`,
              label: p.name,
              detail: p.version || 'installed',
              kind: 'package' as const,
              path: '/packages',
            })),
          ...users.map((u) => ({
            id: `user-${u.id}`,
            label: u.username,
            detail: `${u.shell}${u.isSystem ? ' · service account' : ''}`,
            kind: 'user' as const,
            path: '/users',
          })),
          ...databases.map((d) => ({
            id: `db-${d.port}`,
            label: d.engine,
            detail: `listening on ${d.port}`,
            kind: 'database' as const,
            path: '/databases',
          })),
        ]);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setResources([]);
        setError(
          e instanceof ApiError && e.status === 401
            ? 'Unauthorized - set a valid Agent Token under Settings.'
            : `Could not reach the agent: ${e instanceof Error ? e.message : 'unknown error'}`
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const byKind = {} as Record<IndexedResource['kind'], number>;
    for (const kind of Object.keys(KIND_META) as IndexedResource['kind'][]) byKind[kind] = 0;
    for (const r of resources) byKind[r.kind] += 1;
    return byKind;
  }, [resources]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return resources
      .filter((r) => r.label.toLowerCase().includes(q) || r.detail.toLowerCase().includes(q))
      .slice(0, 40);
  }, [query, resources]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <span>Resource Explorer</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Searches Docker containers, systemd services, installed packages, host accounts and
            detected databases - all read live from the agent.
          </p>
        </div>

        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="break-words">{error}</span>
        </div>
      )}

      <Card className="bg-card/70 border-border/70 p-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-5 w-5 text-primary" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search containers, services, packages, users, databases..."
            className="pl-11 h-11 text-sm bg-card"
            autoFocus
          />
        </div>

        <div className="space-y-2 pt-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Indexed{loading ? '' : ` (${resources.length} resources)`}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(Object.keys(KIND_META) as IndexedResource['kind'][]).map((kind) => {
              const meta = KIND_META[kind];
              const Icon = meta.icon;
              return (
                <div key={kind} className="flex items-center space-x-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <Icon className={`h-5 w-5 shrink-0 ${meta.color}`} />
                  <div className="min-w-0">
                    {/* Real counts, derived from what the agent returned. */}
                    <span className="text-xs font-bold text-foreground block">
                      {loading ? '—' : counts[kind]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{meta.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {query.trim() && (
        <Card className="bg-card/70 border-border/70 p-4 space-y-1">
          {matches.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No resources match “{query.trim()}”.
            </p>
          ) : (
            matches.map((r) => {
              const meta = KIND_META[r.kind];
              const Icon = meta.icon;
              return (
                <button
                  key={r.id}
                  onClick={() => navigate(r.path)}
                  className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left hover:border-border/60 hover:bg-muted/40 transition-colors"
                >
                  <Icon className={`h-4 w-4 shrink-0 ${meta.color}`} />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-foreground font-mono block truncate">{r.label}</span>
                    <span className="text-[11px] text-muted-foreground truncate block">{r.detail}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono shrink-0">
                    {r.kind}
                  </Badge>
                </button>
              );
            })
          )}
        </Card>
      )}
    </div>
  );
}

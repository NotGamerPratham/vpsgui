import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Loader2, AlertCircle, X } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { apiClient } from '../../api/client';

interface ProxyRule {
  id: string;
  domain: string;
  upstream: string;
  ssl: string;
  expires: string;
  status: string;
}

export function ReverseProxyPage() {
  const [proxyRules, setProxyRules] = useState<ProxyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [domain, setDomain] = useState('');
  const [upstream, setUpstream] = useState('http://127.0.0.1:3000');
  const [listenPort, setListenPort] = useState('80');
  const [websockets, setWebsockets] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadRules = () => {
    setLoading(true);
    apiClient.get<ProxyRule[]>('/proxy/rules')
      .then((data) => setProxyRules(Array.isArray(data) ? data : []))
      .catch(() => setProxyRules([]))
      .finally(() => setLoading(false));
  };

  useEffect(loadRules, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      const result = await apiClient.post<{ success: boolean; error?: string; file?: string; reloaded?: boolean; note?: string | null }>(
        '/proxy/rules',
        { domain: domain.trim(), upstream: upstream.trim(), listenPort: Number(listenPort), websockets },
      );
      if (!result.success) {
        setFormError(result.error || 'Could not create the proxy host');
        return;
      }
      // The agent reports separately whether nginx reloaded, because a valid
      // config that has not been reloaded is not yet serving traffic.
      setNotice(result.note ? `Created ${result.file}. ${result.note}` : `Created ${result.file} and reloaded nginx.`);
      setShowAdd(false);
      setDomain('');
      loadRules();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create the proxy host');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span>Nginx / Caddy Reverse Proxy & SSL</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure reverse proxy domain routing, upstream server targets, and automated SSL certificate renewals.
          </p>
        </div>

        <Button onClick={() => { setShowAdd((v) => !v); setFormError(null); }} className="gap-1.5 text-xs bg-primary">
          {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          <span>{showAdd ? 'Cancel' : 'Add Proxy Host'}</span>
        </Button>
      </div>

      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="break-words">{notice}</span>
        </div>
      )}

      {showAdd && (
        <Card className="bg-card/70 border-border/70 p-5">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 block">
                <span className="text-xs font-medium text-foreground">Domain</span>
                <input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  required
                  placeholder="app.example.com"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <span className="text-[11px] text-muted-foreground">
                  Point this name at the server&apos;s IP before the rule will serve traffic.
                </span>
              </label>

              <label className="space-y-1.5 block">
                <span className="text-xs font-medium text-foreground">Upstream</span>
                <input
                  value={upstream}
                  onChange={(e) => setUpstream(e.target.value)}
                  required
                  placeholder="http://127.0.0.1:3000"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <span className="text-[11px] text-muted-foreground">
                  Where nginx forwards the request. Usually a local port.
                </span>
              </label>

              <label className="space-y-1.5 block">
                <span className="text-xs font-medium text-foreground">Listen port</span>
                <input
                  value={listenPort}
                  onChange={(e) => setListenPort(e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <span className="text-[11px] text-muted-foreground">
                  80 for plain HTTP. Add TLS afterwards with certbot.
                </span>
              </label>

              <label className="flex items-start gap-2 pt-6">
                <input
                  type="checkbox"
                  checked={websockets}
                  onChange={(e) => setWebsockets(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-primary"
                />
                <span className="text-xs text-muted-foreground">
                  Forward WebSocket upgrades. Leave on unless the upstream is plain HTTP only.
                </span>
              </label>
            </div>

            {formError && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span className="break-words whitespace-pre-wrap">{formError}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={saving} className="gap-1.5 text-xs bg-primary">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                <span>{saving ? 'Writing vhost…' : 'Create and reload nginx'}</span>
              </Button>
              <span className="text-[11px] text-muted-foreground">
                The config is tested with <span className="font-mono">nginx -t</span> first and removed again if it fails.
              </span>
            </div>
          </form>
        </Card>
      )}

      <Card className="bg-card/70 border-border/70 overflow-hidden">
        {proxyRules.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No Reverse Proxy Rules Configured</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Configure Nginx or Caddy reverse proxy rules from the VPSGUI agent to manage domain routing and SSL certificates.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Domain Name</TableHead>
                <TableHead className="text-xs">Upstream Target</TableHead>
                <TableHead className="text-xs">SSL Provider</TableHead>
                <TableHead className="text-xs">SSL Expiry</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proxyRules.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold text-xs font-mono text-foreground">{p.domain}</TableCell>
                  <TableCell className="font-mono text-xs text-primary">{p.upstream}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.ssl}</TableCell>
                  {/* The agent sends the certificate's notAfter as ISO-8601, or '' when the vhost
                      has no certificate. Colour by proximity instead of an unconditional green. */}
                  <TableCell className="font-mono text-xs">
                    {(() => {
                      if (!p.expires) return <span className="text-muted-foreground">—</span>;
                      const expiry = new Date(p.expires);
                      if (Number.isNaN(expiry.getTime())) {
                        return <span className="text-muted-foreground">{p.expires}</span>;
                      }
                      const daysLeft = Math.round((expiry.getTime() - Date.now()) / 86400000);
                      const tone =
                        daysLeft < 0 ? 'text-rose-400' : daysLeft < 14 ? 'text-amber-400' : 'text-emerald-400';
                      return (
                        <span className={tone} title={expiry.toISOString()}>
                          {expiry.toLocaleDateString()} ({daysLeft < 0 ? 'expired' : `${daysLeft}d`})
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="success" className="text-[10px] uppercase font-mono">{p.status}</Badge>
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

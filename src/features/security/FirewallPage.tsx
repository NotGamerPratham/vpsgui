import React, { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, Plus, Trash2, ShieldCheck, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { securityService } from '../../services/securityService';
import { FirewallRule } from '../../types/security';

const ACTIONS = ['allow', 'deny', 'reject', 'limit'] as const;
const PROTOCOLS = ['tcp', 'udp', 'any'] as const;

export function FirewallPage() {
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [action, setAction] = useState<(typeof ACTIONS)[number]>('allow');
  const [port, setPort] = useState('');
  const [protocol, setProtocol] = useState<(typeof PROTOCOLS)[number]>('tcp');
  const [source, setSource] = useState('any');

  const load = useCallback(async () => {
    setLoading(true);
    const { rules: list, error: fetchError } = await securityService.fetchFirewallRules();
    setRules(list);
    setError(fetchError);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!port.trim()) return;

    setBusy('add');
    setError(null);
    // Runs a real `ufw <action> from <source> to any port <port> proto <proto>` on the host.
    const result = await securityService.applyFirewallRule({ action, port: port.trim(), protocol, source: source.trim() || 'any' });
    if (result.success) {
      setShowAdd(false);
      setPort('');
      await load();
    } else {
      setError(result.output);
    }
    setBusy(null);
  };

  const handleDelete = async (rule: FirewallRule) => {
    // ufw deletes by rule number; ours are ids of the form "ufw-<n>" from `ufw status numbered`.
    const ruleNumber = Number.parseInt(rule.id.replace(/^ufw-/, ''), 10);
    if (!Number.isInteger(ruleNumber)) {
      setError(`Cannot determine the ufw rule number for ${rule.id}`);
      return;
    }
    if (!window.confirm(`Delete ufw rule ${ruleNumber} (${rule.action} ${rule.port}/${rule.protocol} from ${rule.sourceIp})?`)) {
      return;
    }

    setBusy(rule.id);
    setError(null);
    const result = await securityService.applyFirewallRule({ action: 'delete', ruleNumber });
    if (!result.success) setError(result.output);
    // Rule numbers shift after a delete, so always re-read rather than mutating local state.
    await load();
    setBusy(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <span>Firewall (ufw)</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rules read from <code className="font-mono">ufw status numbered</code> on the host. Changes
            run real ufw commands and take effect immediately.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button size="sm" onClick={() => setShowAdd((v) => !v)} className="gap-1.5 text-xs bg-primary">
            <Plus className="h-4 w-4" />
            <span>{showAdd ? 'Cancel' : 'Add Rule'}</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="break-words whitespace-pre-wrap">{error}</span>
        </div>
      )}

      {showAdd && (
        <Card className="bg-card/70 border-border/70 p-4">
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor="fw-action" className="text-[11px] text-muted-foreground">Action</label>
              <select
                id="fw-action"
                value={action}
                onChange={(e) => setAction(e.target.value as (typeof ACTIONS)[number])}
                className="block h-9 rounded-md border border-input bg-card px-2 text-xs text-foreground"
              >
                {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="fw-port" className="text-[11px] text-muted-foreground">Port / range</label>
              <Input
                id="fw-port"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="22 or 6000:6010 or 80,443"
                required
                className="text-xs bg-card font-mono w-52"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="fw-proto" className="text-[11px] text-muted-foreground">Protocol</label>
              <select
                id="fw-proto"
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as (typeof PROTOCOLS)[number])}
                className="block h-9 rounded-md border border-input bg-card px-2 text-xs text-foreground"
              >
                {PROTOCOLS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="fw-source" className="text-[11px] text-muted-foreground">Source</label>
              <Input
                id="fw-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="any or 203.0.113.0/24"
                className="text-xs bg-card font-mono w-48"
              />
            </div>

            <Button type="submit" size="sm" disabled={busy === 'add'} className="gap-1.5 text-xs bg-primary h-9">
              {busy === 'add' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              <span>{busy === 'add' ? 'Applying...' : 'Apply rule'}</span>
            </Button>
          </form>

          <p className="text-[11px] text-amber-400/90 mt-3">
            Take care not to lock yourself out - denying port 22, or the port serving this page, will
            cut your own access.
          </p>
        </Card>
      )}

      <Card className="bg-card/70 border-border/70 overflow-hidden">
        {rules.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">
                {loading ? 'Reading ufw rules...' : 'No ufw rules reported'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                {error
                  ? 'The agent could not read the firewall.'
                  : 'ufw may be inactive or not installed. Rules added here appear once ufw reports them.'}
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">#</TableHead>
                <TableHead className="text-xs">Action</TableHead>
                <TableHead className="text-xs">Port / Range</TableHead>
                <TableHead className="text-xs">Protocol</TableHead>
                <TableHead className="text-xs">Source</TableHead>
                <TableHead className="text-xs">Direction</TableHead>
                <TableHead className="text-xs text-right">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.id.replace(/^ufw-/, '')}</TableCell>
                  <TableCell>
                    <Badge
                      variant={r.action === 'allow' ? 'success' : r.action === 'limit' ? 'warning' : 'destructive'}
                      className="text-[10px] px-2 py-0.5 uppercase font-mono"
                    >
                      {r.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-foreground">{r.port}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground uppercase">{r.protocol}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.sourceIp}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.direction}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(r)}
                      disabled={busy === r.id}
                      title="Delete this ufw rule"
                      className="h-7 w-7 p-0 hover:text-rose-400"
                    >
                      {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
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

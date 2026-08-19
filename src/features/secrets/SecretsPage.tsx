import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Plus, Trash2, Eye, EyeOff, RefreshCw, AlertCircle, Loader2, ShieldAlert } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { securityService } from '../../services/securityService';
import { SecretItem } from '../../types/security';

export function SecretsPage() {
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [environment, setEnvironment] = useState('production');

  const load = useCallback(async () => {
    setLoading(true);
    const { secrets: list, error: fetchError } = await securityService.fetchSecrets();
    setSecrets(list);
    setError(fetchError);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !value) return;

    setBusy('add');
    setError(null);
    const result = await securityService.saveSecret({ name: name.trim(), value, environment });
    if (result.success) {
      setShowAdd(false);
      setName('');
      setValue('');
      await load();
    } else {
      setError(result.error || 'Could not save the secret');
    }
    setBusy(null);
  };

  const handleDelete = async (s: SecretItem) => {
    if (!window.confirm(`Delete secret ${s.name}? This cannot be undone.`)) return;
    setBusy(s.id);
    setError(null);
    const result = await securityService.deleteSecret(s.name);
    if (!result.success) setError(result.error || 'Delete failed');
    setRevealed((prev) => {
      const next = { ...prev };
      delete next[s.name];
      return next;
    });
    await load();
    setBusy(null);
  };

  const handleToggleReveal = async (s: SecretItem) => {
    if (revealed[s.name] !== undefined) {
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[s.name];
        return next;
      });
      return;
    }

    setBusy(s.id);
    setError(null);
    // Decryption is a separate, explicit request — the list endpoint never returns values.
    const result = await securityService.revealSecret(s.name);
    if (result.success && result.value !== undefined) {
      setRevealed((prev) => ({ ...prev, [s.name]: result.value as string }));
    } else {
      setError(result.error || 'Could not decrypt');
    }
    setBusy(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <span>Secrets</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Stored on the host encrypted with AES-256-GCM. Values are never included in the list —
            revealing one is a separate request.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button size="sm" onClick={() => setShowAdd((v) => !v)} className="gap-1.5 text-xs bg-primary">
            <Plus className="h-4 w-4" />
            <span>{showAdd ? 'Cancel' : 'New secret'}</span>
          </Button>
        </div>
      </div>

      {/* Being precise about the threat model matters more here than anywhere else in the app. */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          <span className="font-semibold">What this protects against:</span> values never sit in
          plaintext on disk, so they are not exposed by a stray backup, log, or file read.{' '}
          <span className="font-semibold">What it does not:</span> the agent runs as root and holds
          the key, so anyone with root on this host can decrypt them. For protection from a
          compromised host, use Vault, SOPS, or your platform&apos;s secret store.
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {showAdd && (
        <Card className="bg-card/70 border-border/70 p-4">
          <form onSubmit={handleSave} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor="sec-name" className="text-[11px] text-muted-foreground">Name</label>
              <Input
                id="sec-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="DB_PASSWORD"
                required
                className="text-xs bg-card font-mono w-52"
              />
            </div>
            <div className="space-y-1 flex-1 min-w-[220px]">
              <label htmlFor="sec-value" className="text-[11px] text-muted-foreground">Value</label>
              <Input
                id="sec-value"
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Value to encrypt"
                autoComplete="off"
                required
                className="text-xs bg-card font-mono"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="sec-env" className="text-[11px] text-muted-foreground">Environment</label>
              <select
                id="sec-env"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className="block h-9 rounded-md border border-input bg-card px-2 text-xs text-foreground"
              >
                {['production', 'staging', 'development'].map((env) => (
                  <option key={env} value={env}>{env}</option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm" disabled={busy === 'add'} className="gap-1.5 text-xs bg-primary h-9">
              {busy === 'add' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
              <span>{busy === 'add' ? 'Encrypting...' : 'Save'}</span>
            </Button>
          </form>
          <p className="text-[11px] text-muted-foreground mt-3">
            Saving an existing name overwrites its value. Names must match{' '}
            <code className="font-mono">[A-Za-z_][A-Za-z0-9_]*</code>.
          </p>
        </Card>
      )}

      <Card className="bg-card/70 border-border/70 overflow-hidden">
        {secrets.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">
                {loading ? 'Reading secrets...' : 'No secrets stored'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                {error ? 'The agent could not be reached.' : 'Use "New secret" to store the first one.'}
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Environment</TableHead>
                <TableHead className="text-xs">Value</TableHead>
                <TableHead className="text-xs">Updated</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.map((sec) => (
                <TableRow key={sec.id}>
                  <TableCell className="font-bold text-xs font-mono text-foreground">{sec.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">{sec.environment}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground break-all max-w-[280px]">
                    {revealed[sec.name] ?? sec.maskedValue}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {sec.updatedAt ? new Date(sec.updatedAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleReveal(sec)}
                        disabled={busy === sec.id}
                        title={revealed[sec.name] !== undefined ? 'Hide value' : 'Decrypt and show value'}
                        className="h-7 w-7 p-0"
                      >
                        {busy === sec.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : revealed[sec.name] !== undefined ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(sec)}
                        disabled={busy === sec.id}
                        title="Delete this secret"
                        className="h-7 w-7 p-0 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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

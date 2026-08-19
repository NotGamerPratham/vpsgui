import React, { useState, useEffect, useCallback } from 'react';
import { Archive, Plus, RotateCcw, Trash2, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { apiClient, ApiError } from '../../api/client';

/** Matches the agent's GET /backups payload: real tar.gz archives on disk. */
interface BackupItem {
  id: string;
  name: string;
  path: string;
  sizeBytes: number;
  size: string;
  target: string;
  /** ISO-8601 mtime of the archive. */
  date: string;
  status: string;
}

export function BackupsPage() {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [sourcePath, setSourcePath] = useState('/var/www');
  const [label, setLabel] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<BackupItem[]>('/backups');
      setBackups(Array.isArray(data) ? data : []);
    } catch (e) {
      setBackups([]);
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourcePath.trim()) return;

    setBusy('create');
    setError(null);
    try {
      // Archiving a large tree takes minutes; the agent allows up to 10.
      const res = await apiClient.post<{ success: boolean; name?: string; error?: string }>(
        '/backups/create',
        { sourcePath: sourcePath.trim(), label: label.trim() || undefined },
        600000
      );
      if (res?.success) {
        setShowCreate(false);
        setLabel('');
        await load();
      } else {
        setError(res?.error || 'Backup failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Backup failed');
    }
    setBusy(null);
  };

  const handleDelete = async (b: BackupItem) => {
    if (!window.confirm(`Delete archive ${b.name}? This cannot be undone.`)) return;
    setBusy(b.id);
    setError(null);
    try {
      const res = await apiClient.post<{ success: boolean; error?: string }>('/backups/delete', { name: b.name });
      if (!res?.success) setError(res?.error || 'Delete failed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
    await load();
    setBusy(null);
  };

  const handleRestore = async (b: BackupItem) => {
    const destination = window.prompt(
      `Extract ${b.name} into which directory?\n\nExisting files with the same names WILL be overwritten.`,
      '/var/www'
    );
    if (!destination?.trim()) return;
    if (!window.confirm(`Extract ${b.name} into ${destination.trim()}? Existing files may be overwritten.`)) return;

    setBusy(b.id);
    setError(null);
    try {
      const res = await apiClient.post<{ success: boolean; error?: string; restoredTo?: string }>(
        '/backups/restore',
        { name: b.name, destination: destination.trim() },
        600000
      );
      if (!res?.success) setError(res?.error || 'Restore failed');
      else window.alert(`Restored into ${res.restoredTo}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed');
    }
    setBusy(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" />
            <span>Archive Backups</span>
          </h1>
          {/* Previously promised "automatic daily snapshots, offsite S3 uploads, retention policies".
              None of that exists. What the agent really does is create local tar.gz archives. */}
          <p className="text-xs text-muted-foreground mt-0.5">
            <code className="font-mono">tar.gz</code> archives of a directory, written to the agent&apos;s
            backup directory. There is no scheduler and no offsite upload — pair this with cron, or
            use restic/borg for incremental and remote backups.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button size="sm" onClick={() => setShowCreate((v) => !v)} className="gap-1.5 text-xs bg-primary">
            <Plus className="h-4 w-4" />
            <span>{showCreate ? 'Cancel' : 'Create archive'}</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="break-words whitespace-pre-wrap">{error}</span>
        </div>
      )}

      {showCreate && (
        <Card className="bg-card/70 border-border/70 p-4">
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 flex-1 min-w-[240px]">
              <label htmlFor="bk-src" className="text-[11px] text-muted-foreground">
                Directory to archive (must be inside the agent&apos;s file roots)
              </label>
              <Input
                id="bk-src"
                value={sourcePath}
                onChange={(e) => setSourcePath(e.target.value)}
                placeholder="/var/www/myapp"
                required
                className="text-xs bg-card font-mono"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="bk-label" className="text-[11px] text-muted-foreground">Label (optional)</label>
              <Input
                id="bk-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="pre-upgrade"
                className="text-xs bg-card font-mono w-44"
              />
            </div>
            <Button type="submit" size="sm" disabled={busy === 'create'} className="gap-1.5 text-xs bg-primary h-9">
              {busy === 'create' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
              <span>{busy === 'create' ? 'Archiving...' : 'Create'}</span>
            </Button>
          </form>
          <p className="text-[11px] text-muted-foreground mt-3">
            Large directories can take several minutes. The archive is timestamped automatically.
          </p>
        </Card>
      )}

      <Card className="bg-card/70 border-border/70 overflow-hidden">
        {backups.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <Archive className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">
                {loading ? 'Reading archives...' : 'No archives yet'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                {error ? 'The agent could not be reached.' : 'Use "Create archive" to make the first one.'}
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Archive</TableHead>
                <TableHead className="text-xs">Size</TableHead>
                <TableHead className="text-xs">Location</TableHead>
                <TableHead className="text-xs">Created</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-bold text-xs font-mono text-foreground break-all">{b.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{b.size}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono truncate max-w-[200px]" title={b.target}>
                    {b.target}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {new Date(b.date).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestore(b)}
                        disabled={busy === b.id}
                        title="Extract this archive into a directory"
                        className="h-7 text-[11px] gap-1"
                      >
                        {busy === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                        Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(b)}
                        disabled={busy === b.id}
                        title="Delete this archive"
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

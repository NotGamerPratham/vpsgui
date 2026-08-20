import React, { useState, useEffect, useCallback } from 'react';
import { Key, RefreshCw, AlertCircle } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { apiClient, ApiError } from '../../api/client';

/** Matches the agent's GET /security/ssh-keys payload (public keys from authorized_keys only). */
interface SshKeyItem {
  id: string;
  /** Host user whose authorized_keys the entry came from. */
  user: string;
  /** The key's trailing comment, or a generated label when it has none. */
  label: string;
  algorithm: string;
  fingerprint: string;
  path: string;
}

export function SshKeysPage() {
  const [keys, setKeys] = useState<SshKeyItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<SshKeyItem[]>('/security/ssh-keys');
      setKeys(Array.isArray(data) ? data : []);
    } catch (e) {
      setKeys([]);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <span>SSH Public Keys Manager</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Public keys found in <code className="font-mono">authorized_keys</code> for root and each
            readable home directory. Private keys are never read.
          </p>
        </div>

        {/* "Add SSH Key" had no handler and the agent exposes no write endpoint for authorized_keys.
            Edit the file directly from the File Manager or Terminal page. */}
        <Button onClick={load} disabled={loading} className="gap-1.5 text-xs bg-primary">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {keys.length === 0 ? (
        <Card className="bg-card/70 border-border/70 p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <Key className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No SSH Keys Registered</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Add your SSH public keys to manage authorized access to your Linux VPS nodes.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {keys.map((k) => (
            <Card key={k.id} className="bg-card/70 border-border/70 p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2 min-w-0">
                  <Key className="h-4 w-4 text-primary shrink-0" />
                  <h3 className="font-bold text-sm text-foreground truncate" title={k.label}>{k.label}</h3>
                </div>
                <Badge variant="outline" className="font-mono text-[10px] shrink-0">{k.algorithm}</Badge>
              </div>

              <div
                className="bg-muted/40 p-2.5 rounded border border-border/40 font-mono text-[11px] text-muted-foreground truncate"
                title={k.fingerprint}
              >
                {k.fingerprint}
              </div>

              {/* Shows the real source of the key. "Deployed to {n} Nodes" was a field the agent
                  never sent, so every card read "Deployed to undefined Nodes". */}
              <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-2 gap-2">
                <span className="font-mono truncate" title={k.path}>{k.user}</span>
                <span className="font-mono text-[10px] shrink-0 truncate max-w-[55%]" title={k.path}>{k.path}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { Key, Plus, Trash2, ShieldCheck, Copy, Check } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

export function SshKeysPage() {
  const keys = [
    { id: 'key-1', name: 'DevOps Primary Keypair', fingerprint: 'SHA256:x94820492840284902849208492084', type: 'ED25519', added: '2026-01-10', nodes: 4 },
    { id: 'key-2', name: 'CI/CD Deploy Key', fingerprint: 'SHA256:b8102948102948102948102948102', type: 'RSA-4096', added: '2026-03-15', nodes: 2 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <span>SSH Public Keys Manager</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage public SSH keys deployed to VPS node root / authorized_keys files.
          </p>
        </div>

        <Button className="gap-1.5 text-xs bg-primary">
          <Plus className="h-4 w-4" />
          <span>Add SSH Key</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {keys.map((k) => (
          <Card key={k.id} className="bg-card/70 border-border/70 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Key className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm text-foreground">{k.name}</h3>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">{k.type}</Badge>
            </div>

            <div className="bg-muted/40 p-2.5 rounded border border-border/40 font-mono text-[11px] text-muted-foreground truncate">
              {k.fingerprint}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-2">
              <span>Deployed to {k.nodes} Nodes</span>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-rose-400">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Lock, Plus, Trash2, Key, ShieldCheck } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { securityService } from '../../services/securityService';
import { SecretItem } from '../../types/security';

export function SecretsPage() {
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    securityService.fetchSecrets().then((res) => {
      setSecrets(res);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <span>Secrets & HashiCorp Vault Store</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Encrypted organization environment variables, secret API tokens, and deployment keys.
          </p>
        </div>

        <Button className="gap-1.5 text-xs bg-primary">
          <Plus className="h-4 w-4" />
          <span>New Secret</span>
        </Button>
      </div>

      <Card className="bg-card/70 border-border/70 overflow-hidden">
        {secrets.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No Encrypted Secrets Stored</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Store environment variables, API tokens, and deployment SSH keys securely.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Secret Key Name</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Environment</TableHead>
                <TableHead className="text-xs">Masked Value</TableHead>
                <TableHead className="text-xs">Updated By</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.map((sec) => (
                <TableRow key={sec.id}>
                  <TableCell className="font-bold text-xs font-mono text-foreground">{sec.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">{sec.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="purple" className="text-[10px] uppercase font-mono">{sec.environment}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{sec.maskedValue}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{sec.updatedBy}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-rose-400">
                      <Trash2 className="h-3.5 w-3.5" />
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

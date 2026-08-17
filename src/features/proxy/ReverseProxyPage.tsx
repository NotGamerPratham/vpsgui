import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus } from 'lucide-react';
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

  useEffect(() => {
    apiClient.get<ProxyRule[]>('/proxy/rules')
      .then((data) => setProxyRules(Array.isArray(data) ? data : []))
      .catch(() => setProxyRules([]))
      .finally(() => setLoading(false));
  }, []);

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

        <Button className="gap-1.5 text-xs bg-primary">
          <Plus className="h-4 w-4" />
          <span>Add Proxy Host</span>
        </Button>
      </div>

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
                  <TableCell className="font-mono text-xs text-emerald-400">{p.expires}</TableCell>
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

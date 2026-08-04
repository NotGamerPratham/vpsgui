import React from 'react';
import { ShieldCheck, Plus, CheckCircle2, Lock } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';

export function ReverseProxyPage() {
  const proxyRules = [
    { id: 'px-1', domain: 'api.vpsgui.com', upstream: 'http://127.0.0.1:8080', ssl: "Let's Encrypt", expires: '74 days', status: 'active' },
    { id: 'px-2', domain: 'dash.vpsgui.dev', upstream: 'http://127.0.0.1:3000', ssl: 'Cloudflare SSL', expires: '240 days', status: 'active' },
  ];

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
      </Card>
    </div>
  );
}

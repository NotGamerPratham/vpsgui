import React, { useState, useEffect } from 'react';
import { ShieldAlert, Plus, Trash2, ShieldCheck } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { securityService } from '../../services/securityService';
import { FirewallRule } from '../../types/security';

export function FirewallPage() {
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    securityService.fetchFirewallRules().then((res) => {
      setRules(res);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <span>Firewall & Fail2ban Security</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure UFW / iptables packet filtering rules directly on the VPS host.
          </p>
        </div>

        <Button className="gap-1.5 text-xs bg-primary">
          <Plus className="h-4 w-4" />
          <span>Add Firewall Rule</span>
        </Button>
      </div>

      <Card className="bg-card/70 border-border/70 overflow-hidden">
        {rules.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No Custom Firewall Rules Configured</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                UFW default policy is active on the VPS host. Click 'Add Firewall Rule' to open custom inbound ports.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Action</TableHead>
                <TableHead className="text-xs">Port / Range</TableHead>
                <TableHead className="text-xs">Protocol</TableHead>
                <TableHead className="text-xs">Source IP</TableHead>
                <TableHead className="text-xs">Comment</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <Badge variant={rule.action === 'allow' ? 'success' : 'destructive'} className="text-[10px] uppercase font-mono">
                      {rule.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold text-xs font-mono text-foreground">{rule.port}</TableCell>
                  <TableCell className="font-mono text-xs text-primary uppercase">{rule.protocol}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{rule.sourceIp}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{rule.comment}</TableCell>
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

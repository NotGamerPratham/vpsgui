import React, { useState, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { securityService } from '../../services/securityService';
import { AuditLogEvent } from '../../types/auth';

export function AuditCenterPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    securityService.fetchAuditLogs()
      .then((data) => setAuditLogs(Array.isArray(data) ? data : []))
      .catch(() => setAuditLogs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <span>Audit Center & Security Events</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Immutable security event timeline logging all administrative actions, docker commands, and authentication requests.
          </p>
        </div>
      </div>

      <Card className="bg-card/70 border-border/70 overflow-hidden">
        {auditLogs.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No Audit Events Recorded</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Security audit logs will populate automatically as the VPSGUI agent records administrative actions, authentication attempts, and system events on your VPS.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Timestamp</TableHead>
                <TableHead className="text-xs">Actor</TableHead>
                <TableHead className="text-xs">Action Performed</TableHead>
                <TableHead className="text-xs">Target Object</TableHead>
                <TableHead className="text-xs">IP Address</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{log.timestamp.replace('T', ' ').slice(0, 19)}</TableCell>
                  <TableCell className="font-bold text-xs text-foreground flex items-center gap-2">
                    {log.actor.avatarUrl && (
                      <img src={log.actor.avatarUrl} alt={log.actor.name} className="h-5 w-5 rounded-full object-cover" />
                    )}
                    <span>{log.actor.name}</span>
                  </TableCell>
                  <TableCell className="text-xs font-medium text-foreground">{log.action}</TableCell>
                  <TableCell className="font-mono text-xs text-primary">{log.target}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{log.ipAddress}</TableCell>
                  <TableCell>
                    <Badge variant="success" className="text-[10px] uppercase font-mono">{log.status}</Badge>
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

import React from 'react';
import { Users, Plus, Shield, Check } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';

export function UsersPage() {
  const members = [
    { id: 'usr-1', name: 'Alex Rivers', email: 'alex@vpsgui.com', role: 'Owner', mfa: true, status: 'active' },
    { id: 'usr-2', name: 'Sarah Chen', email: 'sarah@vpsgui.com', role: 'DevOps Admin', mfa: true, status: 'active' },
    { id: 'usr-3', name: 'Marcus Vance', email: 'marcus@vpsgui.com', role: 'Developer', mfa: false, status: 'active' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <span>Organization Team & RBAC Roles</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage organization team members, assign granular permissions, and enforce MFA multi-factor auth.
          </p>
        </div>

        <Button className="gap-1.5 text-xs bg-primary">
          <Plus className="h-4 w-4" />
          <span>Invite Member</span>
        </Button>
      </div>

      <Card className="bg-card/70 border-border/70 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">User Name</TableHead>
              <TableHead className="text-xs">Email</TableHead>
              <TableHead className="text-xs">Role</TableHead>
              <TableHead className="text-xs">MFA Status</TableHead>
              <TableHead className="text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-bold text-xs text-foreground">{m.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{m.email}</TableCell>
                <TableCell>
                  <Badge variant="purple" className="text-[10px] px-2 py-0.5">{m.role}</Badge>
                </TableCell>
                <TableCell className="text-xs font-mono text-emerald-400 font-semibold">
                  {m.mfa ? 'TOTP Enabled' : 'Disabled'}
                </TableCell>
                <TableCell>
                  <Badge variant="success" className="text-[10px] px-2 py-0.5 uppercase">{m.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

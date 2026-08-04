import React, { useState, useEffect } from 'react';
import { Users, Plus, Shield, Check } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { apiClient } from '../../api/client';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  mfa: boolean;
  status: string;
}

export function UsersPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<TeamMember[]>('/users')
      .then((data) => setMembers(Array.isArray(data) ? data : []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, []);

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
        {members.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No Team Members Configured</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Team members and RBAC roles are managed through the VPSGUI backend API. Set up authentication to manage users.
              </p>
            </div>
          </div>
        ) : (
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
        )}
      </Card>
    </div>
  );
}

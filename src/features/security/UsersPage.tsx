import React, { useState, useEffect, useCallback } from 'react';
import { Users, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { apiClient, ApiError } from '../../api/client';

/**
 * Matches the agent's GET /users payload: real accounts parsed from /etc/passwd.
 *
 * This page previously described "Organization Team & RBAC Roles" with Email, Role and MFA columns.
 * VPSGUI has no user database, no roles and no MFA - those columns could only ever be blank or
 * invented. A Linux host does have real accounts, so that is what this shows.
 */
interface SystemUser {
  id: string;
  username: string;
  uid: number;
  gid: number;
  /** GECOS display name; usually empty for service accounts. */
  fullName: string;
  home: string;
  shell: string;
  /** UID below 1000 (and not root) - a service account rather than a person. */
  isSystem: boolean;
  /** False when the login shell is nologin/false. */
  canLogin: boolean;
  groups: string[];
  /** Human-readable last login from `lastlog`, or null when never logged in. */
  lastLogin: string | null;
}

export function UsersPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSystem, setShowSystem] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<SystemUser[]>('/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      setUsers([]);
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

  // Service accounts vastly outnumber real ones on a typical host, so they are hidden by default.
  const visible = showSystem ? users : users.filter((u) => !u.isSystem);
  const systemCount = users.length - users.filter((u) => !u.isSystem).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <span>Host User Accounts</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Accounts from <code className="font-mono">/etc/passwd</code> on the host, with group
            membership and last login. VPSGUI itself has no user database, roles, or MFA.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowSystem((v) => !v)} className="text-xs">
            {showSystem ? 'Hide' : 'Show'} service accounts{systemCount > 0 ? ` (${systemCount})` : ''}
          </Button>
          <Button size="sm" onClick={load} disabled={loading} className="gap-1.5 text-xs bg-primary">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="break-words">{error}</span>
        </div>
      )}

      <Card className="bg-card/70 border-border/70 overflow-hidden">
        {visible.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">
                {loading ? 'Loading accounts...' : 'No accounts reported'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                {error
                  ? 'The agent could not be reached.'
                  : 'Host accounts are read from /etc/passwd, which is available on Linux hosts only.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">User</TableHead>
                  <TableHead className="text-xs">UID</TableHead>
                  <TableHead className="text-xs">Shell</TableHead>
                  <TableHead className="text-xs">Home</TableHead>
                  <TableHead className="text-xs">Groups</TableHead>
                  <TableHead className="text-xs">Last login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-bold text-xs text-foreground">
                      <div className="flex items-center gap-2">
                        {u.uid === 0 && <ShieldCheck className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                        <span className="font-mono">{u.username}</span>
                        {u.fullName && <span className="text-muted-foreground font-normal">({u.fullName})</span>}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{u.uid}</TableCell>
                    <TableCell>
                      <Badge
                        variant={u.canLogin ? 'success' : 'outline'}
                        className="text-[10px] px-2 py-0.5 font-mono"
                        title={u.shell}
                      >
                        {u.canLogin ? 'login' : 'nologin'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[180px]" title={u.home}>
                      {u.home}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]" title={u.groups.join(', ')}>
                      {u.groups.length > 0 ? u.groups.join(', ') : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground truncate max-w-[200px]" title={u.lastLogin ?? ''}>
                      {u.lastLogin ?? 'never'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

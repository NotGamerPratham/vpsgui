import React from 'react';
import { User, ShieldCheck, Key, Lock } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useAuthStore } from '../../store/useAuthStore';

export function ProfilePage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <span>Developer Profile & Security</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage profile information, 2FA TOTP authentication, active sessions, and API tokens.
          </p>
        </div>
      </div>

      <Card className="bg-card/70 border-border/70 p-6 flex flex-col md:flex-row items-center gap-6">
        <img src={user?.avatarUrl} alt={user?.name} className="h-20 w-20 rounded-full object-cover border-2 border-primary" />
        <div className="space-y-1 text-center md:text-left">
          <h2 className="text-lg font-bold text-foreground">{user?.name}</h2>
          <p className="text-xs text-muted-foreground font-mono">{user?.email}</p>
          <div className="flex items-center space-x-2 pt-1 justify-center md:justify-start">
            <Badge variant="purple" className="text-[10px] uppercase">{user?.role}</Badge>
            <Badge variant="success" className="text-[10px]">2FA ACTIVE</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}

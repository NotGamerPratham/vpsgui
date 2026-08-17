import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuthStore } from '../store/useAuthStore';

interface AuthPageProps {
  mode?: 'login' | 'register';
}

export function AuthPage({ mode = 'login' }: AuthPageProps) {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  // Never pre-fill credentials. These fields shipped populated with admin@vpsgui.dev / password123,
  // which reads as a working default account and invites operators to keep it.
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter an email address to identify this local profile.');
      return;
    }
    setError(null);
    login(trimmed);
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md bg-card/80 border-border/80 shadow-2xl p-6 space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 border border-primary/30 text-primary font-bold">
            <Zap className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold tracking-wider text-foreground">VPSGUI</h2>
          <p className="text-xs text-muted-foreground">
            {mode === 'register' ? 'Create a new VPSGUI Organization Workspace' : 'Sign in to your Open Infrastructure Workspace'}
          </p>
        </div>

        {/* Being explicit beats a password field that is silently discarded: the previous form
            collected a password and never checked it, which implied an authentication step that
            does not exist. The agent token is the credential that actually gates host access. */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-300 leading-relaxed">
          <span className="font-bold">This is a local profile, not an account.</span> VPSGUI ships no
          user database, so no password is checked here — this only labels the session on this
          browser. Host access is gated by the <span className="font-semibold">Agent Token</span> you
          set under Settings. Put VPSGUI behind HTTPS and a firewall or VPN.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="vpsgui-email" className="text-xs font-semibold text-foreground">
              Email (profile label)
            </label>
            <Input
              id="vpsgui-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className="text-xs mt-1"
            />
          </div>

          {error && <p className="text-[11px] text-rose-400">{error}</p>}

          <Button type="submit" className="w-full text-xs bg-primary font-bold">
            {mode === 'register' ? 'Create Local Profile' : 'Continue to Workspace'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, ShieldCheck, Zap } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuthStore } from '../store/useAuthStore';

interface AuthPageProps {
  mode?: 'login' | 'register';
}

/**
 * Sign-in, and first-run account creation.
 *
 * This screen used to collect an email, check nothing, and set a localStorage
 * flag. The password is now verified by the agent against a scrypt hash, and
 * the browser receives an HttpOnly cookie it cannot read.
 *
 * Fields are never pre-filled. They once shipped populated with
 * admin@vpsgui.dev / password123, which reads as a working default account and
 * invites operators to keep it.
 */
export function AuthPage({ mode = 'login' }: AuthPageProps) {
  const navigate = useNavigate();
  const { login, bootstrap, refreshSession, isAuthenticated, checking, configured, agentOutdated } =
    useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (checking) void refreshSession();
  }, [checking, refreshSession]);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  // With no account on the host there is nobody to sign in as, so the form
  // becomes first-run setup regardless of which route was requested.
  const setupMode = !configured;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim().toLowerCase();
    if (!name || !password) {
      setError('Enter a username and password.');
      return;
    }
    if (setupMode && password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);
    setError(null);
    const message = setupMode ? await bootstrap(name, password) : await login(name, password);
    setBusy(false);

    if (message) {
      setError(message);
      setPassword('');
      setConfirm('');
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  if (checking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <span className="flex items-center gap-2.5 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Contacting agent…
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md bg-card/80 border-border/80 shadow-2xl p-6 space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 border border-primary/30 text-primary font-bold">
            <Zap className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold tracking-wider text-foreground">VPSGUI</h2>
          <p className="text-xs text-muted-foreground">
            {setupMode
              ? 'Create the first dashboard account for this host'
              : 'Sign in to your Open Infrastructure Workspace'}
          </p>
        </div>

        {agentOutdated && (
          <div className="space-y-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-400">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="font-semibold">The agent on this host is out of date.</span>
            </div>
            <p className="leading-relaxed text-rose-300/90">
              It has no sign-in endpoints, so this form cannot work. The console and the agent are
              deployed separately: pulling and rebuilding updates{' '}
              <span className="font-mono">/var/www/vpsgui</span>, but the agent runs from{' '}
              <span className="font-mono">/opt/vpsgui/agent</span> and is only copied there by the
              installer.
            </p>
            <p className="font-mono text-[11px] text-rose-200">cd /var/www/vpsgui &amp;&amp; sudo ./run.sh</p>
          </div>
        )}

        {setupMode && !agentOutdated && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              No account exists on this host yet. Creating the first one requires the agent token to
              already be saved, so only whoever installed the agent can do this.
            </span>
          </div>
        )}

        {!agentOutdated && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="vpsgui-username" className="text-xs font-semibold text-foreground">
              Username
            </label>
            <Input
              id="vpsgui-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="admin"
              className="text-xs"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="vpsgui-password" className="text-xs font-semibold text-foreground">
              Password
            </label>
            <Input
              id="vpsgui-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={setupMode ? 'new-password' : 'current-password'}
              className="text-xs"
              required
            />
            {setupMode && (
              <p className="text-[11px] text-muted-foreground">
                At least 12 characters. It is hashed with scrypt on the host and never stored in the
                browser.
              </p>
            )}
          </div>

          {setupMode && (
            <div className="space-y-1.5">
              <label htmlFor="vpsgui-confirm" className="text-xs font-semibold text-foreground">
                Confirm password
              </label>
              <Input
                id="vpsgui-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className="text-xs"
                required
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="break-words">{error}</span>
            </div>
          )}

          <Button type="submit" disabled={busy} className="w-full text-xs gap-1.5 bg-primary font-bold">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>
              {busy
                ? setupMode
                  ? 'Creating account…'
                  : 'Signing in…'
                : setupMode
                  ? 'Create account'
                  : 'Sign in'}
            </span>
          </Button>
        </form>
        )}

        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          {mode === 'register' && !setupMode
            ? 'Accounts are created on the host, not from this screen. Ask whoever runs the agent.'
            : 'Sessions last 12 hours and end when the agent restarts.'}
        </p>
      </Card>
    </div>
  );
}

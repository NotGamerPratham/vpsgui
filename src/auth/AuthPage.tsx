import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ShieldCheck, Lock, Mail, Github, Globe } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuthStore } from '../store/useAuthStore';

export function AuthPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('alex@vpsgui.com');
  const [password, setPassword] = useState('password123');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(email);
    navigate('/dashboard');
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md bg-card/80 border-border/80 shadow-2xl p-6 space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 border border-primary/30 text-primary">
            <Zap className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold tracking-wider text-foreground">VPSGUI</h2>
          <p className="text-xs text-muted-foreground">Sign in to your Open Infrastructure Workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground">Work Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="text-xs mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="text-xs mt-1"
            />
          </div>

          <Button type="submit" className="w-full text-xs bg-primary font-bold">
            Sign In to VPSGUI Workspace
          </Button>
        </form>
      </Card>
    </div>
  );
}

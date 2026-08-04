import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Server,
  Terminal,
  Container,
  Box,
  Workflow,
  Archive,
  RotateCw,
  HardDrive,
  ShieldCheck,
} from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';

export function QuickLauncherModal() {
  const navigate = useNavigate();
  const { quickLauncherOpen, setQuickLauncherOpen } = useUIStore();

  if (!quickLauncherOpen) return null;

  const quickActions = [
    { title: 'Add New VPS Server', desc: 'Connect node via SSH or Agent script', icon: Server, color: 'text-primary', path: '/servers?action=add' },
    { title: 'Open SSH Workbench', desc: 'Split terminal with saved command snippets', icon: Terminal, color: 'text-cyan-400', path: '/terminal' },
    { title: 'Deploy 1-Click Application', desc: 'Launch Nginx, Postgres, Redis, WordPress', icon: Box, color: 'text-violet-400', path: '/catalog' },
    { title: 'Create Docker Container', desc: 'Pull image and configure port mappings', icon: Container, color: 'text-emerald-400', path: '/docker/containers' },
    { title: 'Run Automation Workflow', desc: 'Trigger multi-step backup or deployment pipeline', icon: Workflow, color: 'text-amber-400', path: '/automation/workflows' },
    { title: 'Create Snapshot Backup', desc: 'Instant disk volume backup & S3 upload', icon: Archive, color: 'text-rose-400', path: '/backups' },
  ];

  const handleExecute = (path: string) => {
    setQuickLauncherOpen(false);
    navigate(path);
  };

  return (
    <Dialog open={quickLauncherOpen} onOpenChange={setQuickLauncherOpen}>
      <DialogContent className="max-w-xl" onClose={() => setQuickLauncherOpen(false)}>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-base font-bold">
            <Plus className="h-5 w-5 text-primary" />
            <span>Quick Launcher & Action Menu</span>
          </DialogTitle>
          <DialogDescription>
            Select a high-priority action to execute instantly across your workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.title}
                onClick={() => handleExecute(action.path)}
                className="flex items-start space-x-3 rounded-lg border border-border/80 bg-muted/20 p-3 text-left transition-all hover:border-primary/40 hover:bg-muted/60 group"
              >
                <div className="rounded-md bg-muted p-2 border border-border/60 shrink-0 group-hover:scale-105 transition-transform">
                  <Icon className={`h-5 w-5 ${action.color}`} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{action.title}</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{action.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

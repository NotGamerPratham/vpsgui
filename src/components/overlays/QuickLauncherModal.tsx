import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Terminal,
  Container,
  Box,
  Workflow,
  Archive,
  FolderTree,
  ArrowRight,
} from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';

export function QuickLauncherModal() {
  const navigate = useNavigate();
  const { quickLauncherOpen, setQuickLauncherOpen } = useUIStore();

  if (!quickLauncherOpen) return null;

  const quickActions = [
    {
      title: 'Host Terminal',
      desc: 'Run commands via vpsgui-agent',
      icon: Terminal,
      path: '/terminal',
    },
    {
      title: 'File Explorer',
      desc: 'Inspect and edit host directories',
      icon: FolderTree,
      path: '/files',
    },
    {
      title: 'Deploy Application',
      desc: 'Launch services from the open catalog',
      icon: Box,
      path: '/catalog',
    },
    {
      title: 'Docker Containers',
      desc: 'Manage containers, images, and logs',
      icon: Container,
      path: '/docker/containers',
    },
    {
      title: 'Automation Workflows',
      desc: 'Inspect and trigger scheduled tasks',
      icon: Workflow,
      path: '/automation/workflows',
    },
    {
      title: 'Snapshots & Backups',
      desc: 'Review volume archives and exports',
      icon: Archive,
      path: '/backups',
    },
  ];

  const handleExecute = (path: string) => {
    setQuickLauncherOpen(false);
    navigate(path);
  };

  return (
    <Dialog open={quickLauncherOpen} onOpenChange={setQuickLauncherOpen}>
      <DialogContent className="max-w-xl" onClose={() => setQuickLauncherOpen(false)}>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Quick Actions</DialogTitle>
          <DialogDescription>
            Jump directly to an infrastructure module on this host.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.title}
                onClick={() => handleExecute(action.path)}
                className="group flex items-start justify-between gap-3 rounded-2xl border border-border/80 bg-background/60 p-3.5 text-left transition-colors hover:border-foreground/25 hover:bg-accent/50"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/80 bg-card text-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">{action.title}</h4>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{action.desc}</p>
                  </div>
                </div>
                <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground" />
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

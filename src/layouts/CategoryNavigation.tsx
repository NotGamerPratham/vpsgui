import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  Layers,
  Container,
  FolderTree,
  ShieldCheck,
  Activity,
  Workflow,
  Grid,
  Settings,
} from 'lucide-react';
import { cn } from '../lib/utils';

export interface NavigationCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

export const navigationCategories: NavigationCategory[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'infrastructure', label: 'Infrastructure', icon: Server, path: '/servers' },
  { id: 'applications', label: 'Applications', icon: Layers, path: '/deployments' },
  { id: 'docker', label: 'Docker', icon: Container, path: '/docker/containers' },
  { id: 'files', label: 'Files', icon: FolderTree, path: '/file-manager' },
  { id: 'security', label: 'Security', icon: ShieldCheck, path: '/security/firewall' },
  { id: 'monitoring', label: 'Monitoring', icon: Activity, path: '/monitoring' },
  { id: 'automation', label: 'Automation', icon: Workflow, path: '/automation/workflows' },
  { id: 'catalog', label: 'Catalog & Plugins', icon: Grid, path: '/catalog' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];

export function CategoryNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="shrink-0 border-b border-border/70 bg-sidebar/60 px-4 sm:px-5 overflow-x-auto scrollbar-none backdrop-blur-md">
      <div className="flex items-center space-x-1.5 py-2 min-w-max">
        {navigationCategories.map((cat) => {
          const Icon = cat.icon;
          const segment = cat.path.split('/')[1];
          const isActive = location.pathname.startsWith(segment === '' ? '/dashboard' : `/${segment}`);

          return (
            <button
              key={cat.id}
              onClick={() => navigate(cat.path)}
              className={cn(
                'flex items-center space-x-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150',
                isActive
                  ? 'border-foreground/20 bg-accent text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

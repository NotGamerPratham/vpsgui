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
    <div className="border-b border-border/60 bg-card/40 backdrop-blur-md px-4 overflow-x-auto scrollbar-none">
      <div className="flex items-center space-x-1 py-1 min-w-max">
        {navigationCategories.map((cat) => {
          const Icon = cat.icon;
          const isActive = location.pathname.startsWith(cat.path.split('/')[1] === '' ? '/dashboard' : `/${cat.path.split('/')[1]}`);

          return (
            <button
              key={cat.id}
              onClick={() => navigate(cat.path)}
              className={cn(
                'flex items-center space-x-2 px-3 py-2 rounded-md text-xs font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', isActive ? 'text-primary' : 'text-muted-foreground')} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

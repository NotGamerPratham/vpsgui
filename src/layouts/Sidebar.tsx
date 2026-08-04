import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  Grid,
  Map,
  Box,
  Container,
  FolderTree,
  Terminal,
  ShieldCheck,
  Activity,
  Workflow,
  Clock,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Network,
  Cpu,
  Lock,
  GitBranch,
  Globe,
  Database,
  Archive,
  BookOpen,
} from 'lucide-react';
import { useUIStore } from '../store/useUIStore';
import { useServerStore } from '../store/useServerStore';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const { nodes } = useServerStore();

  const navGroups: NavGroup[] = [
    {
      title: 'CORE',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/multivps', label: 'Multi-VPS Matrix', icon: Grid },
        { path: '/topology', label: 'Topology Map', icon: Map },
      ],
    },
    {
      title: 'INFRASTRUCTURE',
      items: [
        { path: '/servers', label: 'Nodes & Servers', icon: Server, badge: nodes.length },
        { path: '/disks', label: 'Storage Disks', icon: HardDrive },
        { path: '/network', label: 'Network Manager', icon: Network },
        { path: '/agent', label: 'vpsgui-agent', icon: Cpu },
      ],
    },
    {
      title: 'APPLICATIONS',
      items: [
        { path: '/catalog', label: 'Open Catalog', icon: Box },
        { path: '/deployments', label: 'Deployments', icon: GitBranch },
        { path: '/proxy', label: 'Reverse Proxy', icon: Globe },
        { path: '/databases', label: 'Databases', icon: Database },
        { path: '/backups', label: 'Snapshots & Backups', icon: Archive },
        { path: '/secrets', label: 'Secrets & Vault', icon: Lock },
      ],
    },
    {
      title: 'DOCKER ENGINE',
      items: [
        { path: '/docker/containers', label: 'Containers', icon: Container },
        { path: '/docker/images', label: 'Docker Images', icon: Box },
      ],
    },
    {
      title: 'FILE & TERMINAL',
      items: [
        { path: '/files', label: 'File Explorer', icon: FolderTree },
        { path: '/terminal', label: 'SSH Workbench', icon: Terminal },
      ],
    },
    {
      title: 'SECURITY',
      items: [
        { path: '/firewall', label: 'Firewall & Rules', icon: ShieldCheck },
        { path: '/ssh-keys', label: 'SSH Keys', icon: Lock },
      ],
    },
    {
      title: 'DEVELOPER & DOCS',
      items: [
        { path: '/docs', label: 'Dev Docs & API', icon: BookOpen },
        { path: '/settings', label: 'Preferences', icon: Settings },
      ],
    },
  ];

  return (
    <aside
      className={`relative flex flex-col border-r border-border bg-sidebar transition-all duration-300 z-30 ${
        sidebarCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-3">
        {!sidebarCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold tracking-wider text-foreground text-sm">VPSGUI</span>
              <span className="block text-[10px] text-muted-foreground font-mono">Workspace v1.0</span>
            </div>
          </div>
        )}

        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {!sidebarCollapsed && (
              <h4 className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {group.title}
              </h4>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-primary/15 text-primary font-bold shadow-sm'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                    }`
                  }
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </div>
                  {!sidebarCollapsed && item.badge !== undefined && (
                    <span className="rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-[10px] font-mono">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Grid2X2,
  Network,
  Server,
  HardDrive,
  Globe,
  Bot,
  Box,
  Layers,
  ShieldCheck,
  Database,
  Archive,
  Lock,
  Container,
  Image as ImageIcon,
  FolderTree,
  Terminal,
  ShieldAlert,
  Key,
  Users,
  Activity,
  HeartPulse,
  Stethoscope,
  Workflow,
  ListTodo,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useUIStore } from '../store/useUIStore';
import { useServerStore } from '../store/useServerStore';
import { cn } from '../lib/utils';

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { nodes } = useServerStore();

  const navGroups = [
    {
      title: 'CORE',
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Multi-VPS Matrix', path: '/multivps', icon: Grid2X2 },
        { label: 'Topology Map', path: '/map', icon: Network },
      ],
    },
    {
      title: 'INFRASTRUCTURE',
      items: [
        { label: 'Nodes & Servers', path: '/servers', icon: Server, badge: nodes.length.toString() },
        { label: 'Storage Disks', path: '/storage', icon: HardDrive },
        { label: 'Network Manager', path: '/network', icon: Globe },
        { label: 'vpsgui-agent', path: '/agent', icon: Bot },
      ],
    },
    {
      title: 'APPLICATIONS',
      items: [
        { label: 'Open Catalog', path: '/catalog', icon: Box },
        { label: 'Deployments', path: '/deployments', icon: Layers },
        { label: 'Reverse Proxy', path: '/reverse-proxy', icon: ShieldCheck },
        { label: 'Databases', path: '/databases', icon: Database },
        { label: 'Snapshots & Backups', path: '/backups', icon: Archive },
        { label: 'Secrets & Vault', path: '/secrets', icon: Lock },
      ],
    },
    {
      title: 'DOCKER ENGINE',
      items: [
        { label: 'Containers', path: '/docker/containers', icon: Container },
        { label: 'Docker Images', path: '/docker/images', icon: ImageIcon },
      ],
    },
    {
      title: 'FILE & TERMINAL',
      items: [
        { label: 'File Explorer', path: '/file-manager', icon: FolderTree },
        { label: 'SSH Workbench', path: '/terminal', icon: Terminal },
      ],
    },
    {
      title: 'SECURITY',
      items: [
        { label: 'Firewall & Rules', path: '/security/firewall', icon: ShieldAlert },
        { label: 'SSH Keys', path: '/security/ssh-keys', icon: Key },
        { label: 'Users & RBAC', path: '/security/users', icon: Users },
      ],
    },
    {
      title: 'MONITORING',
      items: [
        { label: 'Telemetry Metrics', path: '/monitoring', icon: Activity },
        { label: 'Health Matrix', path: '/health', icon: HeartPulse },
        { label: 'Diagnostics Tool', path: '/diagnostics', icon: Stethoscope },
      ],
    },
    {
      title: 'AUTOMATION',
      items: [
        { label: 'Workflows', path: '/automation/workflows', icon: Workflow },
        { label: 'Job Queue', path: '/queue', icon: ListTodo },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        { label: 'Global Settings', path: '/settings', icon: Settings },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        'relative flex flex-col border-r border-border/70 bg-card/60 backdrop-blur-xl transition-all duration-300 z-30 select-none',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-border/50">
        {!sidebarCollapsed && (
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30 text-primary">
              <Zap className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-wider text-foreground">VPSGUI</span>
              <span className="text-[10px] text-muted-foreground font-mono">Workspace v1.0</span>
            </div>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <Zap className="h-4 w-4" />
          </div>
        )}

        <button
          onClick={toggleSidebar}
          className="hidden md:flex h-6 w-6 items-center justify-center rounded-md border border-border/80 bg-background text-muted-foreground hover:text-foreground transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-none">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {!sidebarCollapsed && (
              <h4 className="px-3 text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">
                {group.title}
              </h4>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={cn(
                    'flex w-full items-center rounded-md px-3 py-2 text-xs font-medium transition-colors group relative',
                    isActive
                      ? 'bg-primary/15 text-primary border border-primary/25 font-semibold'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground', !sidebarCollapsed && 'mr-2.5')} />

                  {!sidebarCollapsed && <span className="truncate flex-1 text-left">{item.label}</span>}

                  {!sidebarCollapsed && item.badge && (
                    <span className="ml-auto rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-mono text-primary border border-primary/20">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}

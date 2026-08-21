import React, { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  Settings,
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
  Package,
  Layers,
  X,
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
  const location = useLocation();
  const { sidebarCollapsed, setSidebarCollapsed, mobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const { nodes } = useServerStore();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, setMobileMenuOpen]);

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
        { path: '/packages', label: 'Packages & Runtimes', icon: Package },
        { path: '/services', label: 'Systemd Services', icon: Layers },
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
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-sidebar transition-all duration-300 ${
          mobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-60'}`}
      >
        {/* Brand Header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-3 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20">
              <Server className="h-5 w-5" />
            </div>
            {(!sidebarCollapsed || mobileMenuOpen) && (
              <div>
                <span className="font-bold tracking-wider text-foreground text-sm">VPSGUI</span>
                <span className="block text-[10px] text-muted-foreground font-mono">Workspace v1.0</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="lg:hidden rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              {(!sidebarCollapsed || mobileMenuOpen) && (
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
                      `flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-primary/15 text-primary font-bold shadow-sm'
                          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                      }`
                    }
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className="h-4 w-4 shrink-0" />
                      {(!sidebarCollapsed || mobileMenuOpen) && <span>{item.label}</span>}
                    </div>
                    {(!sidebarCollapsed || mobileMenuOpen) && item.badge !== undefined && (
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

        {/* Footer Developer Credit */}
        {(!sidebarCollapsed || mobileMenuOpen) && (
          <div className="border-t border-border p-3 text-[10px] text-muted-foreground text-center shrink-0">
            Developed by{' '}
            <a
              href="https://notgamerpratham.com"
              target="_blank"
              rel="noreferrer"
              className="text-primary font-bold hover:underline"
            >
              NotGamerPratham
            </a>
          </div>
        )}
      </aside>
    </>
  );
}

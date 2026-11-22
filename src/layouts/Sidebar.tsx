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
        { path: '/terminal', label: 'Host Terminal', icon: Terminal },
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
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-50 flex flex-col border-r border-border/80 bg-sidebar transition-all duration-200 ${
          mobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-60'}`}
      >
        {/* Brand Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 px-3">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Server className="h-4 w-4" />
            </div>
            {(!sidebarCollapsed || mobileMenuOpen) && (
              <div className="leading-tight">
                <span className="text-sm font-semibold tracking-tight text-foreground">VPSGUI</span>
                <span className="block text-[10px] text-muted-foreground">v1.0 console</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden lg:flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground transition-colors"
            >
              {sidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="lg:hidden flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              {(!sidebarCollapsed || mobileMenuOpen) && (
                <h4 className="px-2.5 pb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/75">
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
                      `flex items-center justify-between rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          {(!sidebarCollapsed || mobileMenuOpen) && (
                            <span className="truncate">{item.label}</span>
                          )}
                        </div>
                        {(!sidebarCollapsed || mobileMenuOpen) && item.badge !== undefined && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                              isActive
                                ? 'bg-primary-foreground/15 text-primary-foreground'
                                : 'bg-secondary text-muted-foreground'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer Developer Credit */}
        {(!sidebarCollapsed || mobileMenuOpen) && (
          <div className="shrink-0 border-t border-border/80 px-3 py-3 text-center text-[10px] text-muted-foreground">
            Open source by{' '}
            <a
              href="https://notgamerpratham.com"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              NotGamerPratham
            </a>
          </div>
        )}
      </aside>
    </>
  );
}

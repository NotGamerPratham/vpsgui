import React from 'react';
import {
  Server,
  Search,
  Bell,
  Plus,
  Palette,
  ChevronDown,
  Globe,
  Building2,
  SlidersHorizontal,
} from 'lucide-react';
import { useServerStore } from '../store/useServerStore';
import { useUIStore } from '../store/useUIStore';
import { useAuthStore } from '../store/useAuthStore';
import { themeCatalog, ThemeName } from '../design-system/tokens';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

export function TopNav() {
  const { nodes, selectedNodeId, setSelectedNodeId } = useServerStore();
  const { theme, setTheme, setCommandPaletteOpen, setQuickLauncherOpen, setNotificationsOpen } = useUIStore();
  const { user, currentOrg, organizations, setCurrentOrg } = useAuthStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-border/70 bg-card/80 backdrop-blur-xl px-4 select-none">
      {/* Left section: Node selector & Org Selector */}
      <div className="flex items-center space-x-3">
        {/* Node Selector */}
        <div className="relative flex items-center bg-muted/40 rounded-lg p-1 border border-border/60">
          <Server className="h-4 w-4 text-primary ml-2 mr-1.5 shrink-0" />
          <Select
            value={selectedNodeId || ''}
            onChange={(e) => setSelectedNodeId(e.target.value)}
            className="h-7 border-none bg-transparent text-xs font-semibold focus:ring-0 pl-1 pr-6 py-0 shadow-none cursor-pointer"
          >
            {nodes.map((node) => (
              <option key={node.id} value={node.id} className="bg-card text-foreground">
                {node.name} ({node.network?.publicIp || '127.0.0.1'})
              </option>
            ))}
          </Select>
          {selectedNode && (
            <Badge variant="success" className="ml-2 hidden sm:inline-flex text-[10px] py-0 px-1.5 font-mono">
              {selectedNode.status.toUpperCase()}
            </Badge>
          )}
        </div>

        {/* Org Selector */}
        <div className="hidden lg:flex items-center space-x-2 border-l border-border/60 pl-3">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <Select
            value={currentOrg?.id || ''}
            onChange={(e) => {
              const org = organizations.find((o) => o.id === e.target.value);
              if (org) setCurrentOrg(org);
            }}
            className="h-7 border-none bg-transparent text-xs font-medium focus:ring-0 cursor-pointer shadow-none"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id} className="bg-card text-foreground">
                {org.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Center Section: Spotlight Search Bar */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex w-full items-center justify-between rounded-lg border border-border/80 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted/60 transition-all"
        >
          <div className="flex items-center space-x-2">
            <Search className="h-3.5 w-3.5 text-primary" />
            <span>Search nodes, containers, commands...</span>
          </div>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Right Section: Theme, Actions & User */}
      <div className="flex items-center space-x-2">
        {/* Quick Action Button */}
        <Button
          size="sm"
          onClick={() => setQuickLauncherOpen(true)}
          className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Quick Action</span>
        </Button>

        {/* Theme Picker */}
        <div className="relative flex items-center bg-muted/40 rounded-lg px-2 py-1 border border-border/60">
          <Palette className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
          <Select
            value={theme}
            onChange={(e) => setTheme(e.target.value as ThemeName)}
            className="h-6 border-none bg-transparent text-xs focus:ring-0 p-0 shadow-none cursor-pointer text-muted-foreground hover:text-foreground"
          >
            {themeCatalog.map((t) => (
              <option key={t.id} value={t.id} className="bg-card text-foreground">
                {t.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Notifications Drawer */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setNotificationsOpen(true)}
          className="h-8 w-8 relative text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
        </Button>

        {/* User Profile Avatar */}
        <div className="flex items-center space-x-2 border-l border-border/60 pl-2">
          <img
            src={user?.avatarUrl}
            alt={user?.name}
            className="h-7 w-7 rounded-full border border-border/80 object-cover"
          />
          <div className="hidden xl:flex flex-col text-left">
            <span className="text-xs font-semibold leading-none text-foreground">{user?.name}</span>
            <span className="text-[10px] text-muted-foreground leading-none mt-0.5">{user?.role}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

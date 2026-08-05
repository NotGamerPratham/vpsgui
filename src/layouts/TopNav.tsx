import React from 'react';
import { Search, Plus, Palette, Bell, Globe, ChevronRight } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';
import { useServerStore } from '../store/useServerStore';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { themeCatalog, ThemeName } from '../design-system/tokens';

export function TopNav() {
  const {
    theme,
    setTheme,
    setCommandPaletteOpen,
    setQuickLauncherOpen,
    setNotificationsOpen,
    setSidebarCollapsed,
    sidebarCollapsed,
  } = useUIStore();

  const { selectedNodeId, nodes, setSelectedNodeId } = useServerStore();
  const { currentOrg, organizations, setCurrentOrg } = useAuthStore();
  const { unreadCount } = useNotificationStore();

  const activeNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  return (
    <header className="flex h-14 w-full items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-md z-20">
      {/* Left Section: Active Server Dropdown & Org Selector */}
      <div className="flex items-center space-x-3">
        {/* Active Node Dropdown */}
        <div className="flex items-center rounded-lg bg-muted/60 px-2.5 py-1 border border-border/80 text-xs font-mono">
          <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
          <Select
            value={selectedNodeId || ''}
            onChange={(e) => setSelectedNodeId(e.target.value)}
            className="h-7 border-none bg-transparent text-xs font-bold focus:ring-0 cursor-pointer shadow-none text-foreground"
          >
            {nodes.map((node) => (
              <option key={node.id} value={node.id} className="bg-card text-foreground">
                {node.name} ({node.network.publicIp})
              </option>
            ))}
          </Select>
        </div>

        {/* Organization Switcher */}
        <div className="hidden sm:flex items-center text-xs text-muted-foreground border-l border-border/60 pl-3">
          <Globe className="h-3.5 w-3.5 mr-1.5 text-primary" />
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

      {/* Right Section: Theme & Actions */}
      <div className="flex items-center space-x-2">
        {/* Quick Action Button */}
        <Button
          size="sm"
          onClick={() => setQuickLauncherOpen(true)}
          className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-bold"
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

        {/* Real-Time Notifications Drawer Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setNotificationsOpen(true)}
          className="h-8 w-8 relative text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 font-mono text-[9px] font-bold text-white shadow-sm animate-pulse">
              {unreadCount}
            </span>
          )}
        </Button>
      </div>
    </header>
  );
}

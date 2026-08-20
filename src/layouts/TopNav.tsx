import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Palette, Bell, Globe, Server, Menu, LogOut } from 'lucide-react';
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
    mobileMenuOpen,
    setMobileMenuOpen,
  } = useUIStore();

  const { nodes } = useServerStore();
  const { currentOrg, organizations, setCurrentOrg, user, logout } = useAuthStore();
  const { unreadCount } = useNotificationStore();

  const activeNode = nodes[0];
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="flex h-14 w-full items-center justify-between border-b border-border bg-card/80 px-3 sm:px-4 backdrop-blur-md z-20">
      {/* Left Section: Mobile Menu Toggle & Host Server Badge */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Toggle Navigation Drawer"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Active Host Node Badge */}
        <div className="flex items-center rounded-lg bg-muted/60 px-2.5 py-1 border border-border/80 text-xs font-mono">
          <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse shrink-0" />
          <Server className="h-3.5 w-3.5 mr-1.5 text-primary shrink-0" />
          <span className="font-bold text-foreground truncate max-w-[90px] sm:max-w-none">{activeNode?.name || 'No host'}</span>
          {activeNode?.network?.publicIp && (
            <span className="hidden sm:inline ml-1 text-muted-foreground">({activeNode.network.publicIp})</span>
          )}
        </div>

        {/* Organization Switcher */}
        <div className="hidden lg:flex items-center text-xs text-muted-foreground border-l border-border/60 pl-3">
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
      <div className="flex-1 max-w-md mx-2 sm:mx-4 hidden md:block">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex w-full items-center justify-between rounded-lg border border-border/80 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted/60 transition-all"
        >
          <div className="flex items-center space-x-2">
            <Search className="h-3.5 w-3.5 text-primary" />
            <span className="truncate">Search containers, files, commands...</span>
          </div>
          <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Right Section: Theme & Actions */}
      <div className="flex items-center space-x-1.5 sm:space-x-2">
        {/* Search button for mobile */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Quick Action Button */}
        <Button
          size="sm"
          onClick={() => setQuickLauncherOpen(true)}
          className="h-8 px-2.5 sm:px-3 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-bold"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Quick Action</span>
        </Button>

        {/* Theme Picker */}
        <div className="relative flex items-center bg-muted/40 rounded-lg px-1.5 sm:px-2 py-1 border border-border/60">
          <Palette className="h-3.5 w-3.5 text-muted-foreground mr-1 shrink-0" />
          <Select
            value={theme}
            onChange={(e) => setTheme(e.target.value as ThemeName)}
            className="h-6 border-none bg-transparent text-xs focus:ring-0 p-0 shadow-none cursor-pointer text-muted-foreground hover:text-foreground max-w-[70px] sm:max-w-none"
          >
            {themeCatalog.map((t) => (
              <option key={t.id} value={t.id} className="bg-card text-foreground">
                {t.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Sign out. There was no way to end a session from the UI at all - the
            only exit was clearing site data. */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          title={user ? `Sign out ${user.name}` : 'Sign out'}
          aria-label="Sign out"
          className="h-8 w-8 text-muted-foreground hover:text-rose-400 shrink-0"
        >
          <LogOut className="h-4 w-4" />
        </Button>

        {/* Real-Time Notifications Drawer Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setNotificationsOpen(true)}
          className="h-8 w-8 relative text-muted-foreground hover:text-foreground shrink-0"
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

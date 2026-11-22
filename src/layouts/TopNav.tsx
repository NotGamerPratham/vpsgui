import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ArrowRight,
  Palette,
  Bell,
  Globe,
  Server,
  Menu,
  LogOut,
} from 'lucide-react';
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
  const isOnline = activeNode?.status === 'online';
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="z-20 flex h-14 w-full shrink-0 items-center justify-between border-b border-border/80 bg-sidebar/90 px-3 sm:px-5 backdrop-blur-md">
      {/* Left Section: Mobile Menu Toggle & Active Host Pill */}
      <div className="flex items-center space-x-2.5 sm:space-x-3">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Toggle Navigation Drawer"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Active Host Node Pill */}
        <div className="flex items-center rounded-full border border-border/80 bg-card/80 px-3 py-1.5 text-xs font-mono">
          <span
            className={`mr-2 h-1.5 w-1.5 shrink-0 rounded-full ${
              isOnline ? 'bg-emerald-400' : 'bg-muted-foreground/50'
            }`}
          />
          <Server className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="max-w-[96px] truncate font-medium text-foreground sm:max-w-none">
            {activeNode?.name || 'No host'}
          </span>
          {activeNode?.network?.publicIp && activeNode.network.publicIp !== activeNode.name && (
            <span className="ml-1.5 hidden text-muted-foreground sm:inline">
              {activeNode.network.publicIp}
            </span>
          )}
        </div>

        {/* Organization Switcher */}
        <div className="hidden lg:flex items-center border-l border-border/70 pl-3 text-xs text-muted-foreground">
          <Globe className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
          <Select
            value={currentOrg?.id || ''}
            onChange={(e) => {
              const org = organizations.find((o) => o.id === e.target.value);
              if (org) setCurrentOrg(org);
            }}
            className="h-7 cursor-pointer border-none bg-transparent text-xs font-mono font-medium shadow-none focus:ring-0"
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
      <div className="mx-2 hidden max-w-md flex-1 sm:mx-4 md:block">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex w-full items-center justify-between rounded-full border border-border/80 bg-card/60 px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/25 hover:bg-card hover:text-foreground"
        >
          <div className="flex items-center space-x-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate">Search containers, files, commands...</span>
          </div>
          <kbd className="pointer-events-none hidden h-5 select-none items-center rounded-full border border-border/80 bg-secondary px-2 font-mono text-[10px] text-muted-foreground sm:inline-flex">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right Section: Actions & Theme */}
      <div className="flex items-center space-x-2">
        {/* Mobile search trigger */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCommandPaletteOpen(true)}
          className="h-8 w-8 md:hidden"
          aria-label="Search"
        >
          <Search className="h-3.5 w-3.5" />
        </Button>

        {/* Primary Pill CTA matching reference button style */}
        <Button
          size="sm"
          onClick={() => setQuickLauncherOpen(true)}
          aria-label="Quick Action"
          className="h-8 px-4 text-xs"
        >
          <span className="hidden sm:inline">Quick Action</span>
          <span className="sm:hidden">Action</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
        </Button>

        {/* Theme Picker */}
        <div className="relative flex items-center rounded-full border border-border/80 bg-card/70 px-2.5 py-1">
          <Palette className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Select
            value={theme}
            onChange={(e) => setTheme(e.target.value as ThemeName)}
            aria-label="Color theme"
            className="h-6 max-w-[82px] cursor-pointer border-none bg-transparent p-0 text-xs font-mono text-muted-foreground shadow-none hover:text-foreground focus:ring-0 sm:max-w-none"
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
          variant="outline"
          size="icon"
          onClick={() => setNotificationsOpen(true)}
          aria-label="Notifications"
          className="relative h-8 w-8 shrink-0"
        >
          <Bell className="h-3.5 w-3.5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary font-mono text-[9px] font-semibold text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </Button>

        {/* Sign Out */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleSignOut}
          title={user ? `Sign out ${user.name}` : 'Sign out'}
          aria-label="Sign out"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-rose-400 hover:border-rose-500/30"
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  );
}

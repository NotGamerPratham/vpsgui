import { create } from 'zustand';
import { ThemeName } from '../design-system/tokens';
import { LanguageCode } from '../i18n';

export interface DashboardWidget {
  id: string;
  type: 'metrics_cpu' | 'metrics_ram' | 'server_health' | 'quick_terminal' | 'active_containers' | 'notes' | 'quick_actions';
  title: string;
  gridSpan: number;
}

interface UIState {
  theme: ThemeName;
  language: LanguageCode;
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  quickLauncherOpen: boolean;
  notificationsOpen: boolean;
  activeWidgets: DashboardWidget[];

  // Actions
  setTheme: (theme: ThemeName) => void;
  setLanguage: (lang: LanguageCode) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setQuickLauncherOpen: (open: boolean) => void;
  setNotificationsOpen: (open: boolean) => void;
  toggleWidget: (widgetId: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'vscode_dark',
  language: 'en',
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  quickLauncherOpen: false,
  notificationsOpen: false,
  activeWidgets: [
    { id: 'w-cpu', type: 'metrics_cpu', title: 'Realtime Cluster CPU Load', gridSpan: 2 },
    { id: 'w-ram', type: 'metrics_ram', title: 'RAM & Swap Utilization', gridSpan: 2 },
    { id: 'w-health', type: 'server_health', title: 'Node Health & Uptime', gridSpan: 4 },
    { id: 'w-containers', type: 'active_containers', title: 'Active Docker Containers', gridSpan: 2 },
    { id: 'w-actions', type: 'quick_actions', title: 'Quick Infrastructure Actions', gridSpan: 2 },
  ],

  setTheme: (theme) => {
    set({ theme });
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.add('dark');
    }
  },

  setLanguage: (language) => set({ language }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setQuickLauncherOpen: (open) => set({ quickLauncherOpen: open }),
  setNotificationsOpen: (open) => set({ notificationsOpen: open }),

  toggleWidget: (widgetId) =>
    set((state) => ({
      activeWidgets: state.activeWidgets.some((w) => w.id === widgetId)
        ? state.activeWidgets.filter((w) => w.id !== widgetId)
        : [...state.activeWidgets],
    })),
}));

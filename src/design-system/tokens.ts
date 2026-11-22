export type ThemeName =
  | 'obsidian'
  | 'vscode_dark'
  | 'dracula'
  | 'catppuccin'
  | 'nord'
  | 'onedark'
  | 'tokyonight'
  | 'light';

export interface ThemeDefinition {
  id: ThemeName;
  name: string;
  background: string;
  panelBackground: string;
  accent: string;
  foreground: string;
  cssVars: Record<string, string>;
}

export const themeCatalog: ThemeDefinition[] = [
  {
    id: 'obsidian',
    name: 'Obsidian Mono (Default)',
    background: '#080809',
    panelBackground: '#0E0E10',
    accent: '#ECEBE6',
    foreground: '#ECEBE6',
    cssVars: {
      '--background': '240 6% 3.1%',
      '--sidebar': '240 6% 4.3%',
      '--card': '240 5% 5.8%',
      '--popover': '240 5% 6.5%',
      '--primary': '48 14% 91.4%',
      '--primary-foreground': '240 5% 4.5%',
      '--secondary': '240 4% 11%',
      '--secondary-foreground': '48 12% 88%',
      '--muted': '240 4% 10.5%',
      '--muted-foreground': '240 4% 55%',
      '--accent': '240 4% 13.5%',
      '--accent-foreground': '48 14% 91.4%',
      '--border': '240 4% 15.5%',
      '--input': '240 4% 16.5%',
      '--ring': '48 14% 84%',
      '--foreground': '48 14% 91.4%',
    },
  },
  {
    id: 'vscode_dark',
    name: 'VS Code Dark',
    background: '#0B0F19',
    panelBackground: '#1E293B',
    accent: '#3B82F6',
    foreground: '#F8FAFC',
    cssVars: {
      '--background': '222.2 84% 4.9%',
      '--sidebar': '222.2 84% 5.6%',
      '--card': '222.2 84% 6.5%',
      '--popover': '222.2 84% 6.5%',
      '--primary': '217.2 91.2% 59.8%',
      '--primary-foreground': '222.2 47.4% 11.2%',
      '--secondary': '217.2 32.6% 17.5%',
      '--secondary-foreground': '210 40% 98%',
      '--muted': '217.2 32.6% 17.5%',
      '--muted-foreground': '215 20.2% 65.1%',
      '--accent': '217.2 32.6% 17.5%',
      '--accent-foreground': '210 40% 98%',
      '--border': '217.2 32.6% 17.5%',
      '--input': '217.2 32.6% 17.5%',
      '--ring': '224.3 76.3% 48%',
      '--foreground': '210 40% 98%',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    background: '#282a36',
    panelBackground: '#44475a',
    accent: '#bd93f9',
    foreground: '#f8f8f2',
    cssVars: {
      '--background': '231 15% 18%',
      '--sidebar': '231 15% 16%',
      '--card': '232 14% 24%',
      '--popover': '232 14% 24%',
      '--primary': '265 89% 78%',
      '--primary-foreground': '231 15% 18%',
      '--secondary': '232 14% 31%',
      '--secondary-foreground': '60 30% 96%',
      '--muted': '232 14% 31%',
      '--muted-foreground': '228 13% 75%',
      '--accent': '232 14% 34%',
      '--accent-foreground': '60 30% 96%',
      '--border': '232 14% 31%',
      '--input': '232 14% 31%',
      '--ring': '265 89% 78%',
      '--foreground': '60 30% 96%',
    },
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin Macchiato',
    background: '#24273a',
    panelBackground: '#363a4f',
    accent: '#8aadf4',
    foreground: '#cad3f5',
    cssVars: {
      '--background': '232 23% 18%',
      '--sidebar': '232 23% 16%',
      '--card': '231 18% 24%',
      '--popover': '231 18% 24%',
      '--primary': '220 83% 75%',
      '--primary-foreground': '232 23% 18%',
      '--secondary': '231 18% 30%',
      '--secondary-foreground': '228 67% 88%',
      '--muted': '231 18% 30%',
      '--muted-foreground': '229 23% 75%',
      '--accent': '231 18% 33%',
      '--accent-foreground': '228 67% 88%',
      '--border': '231 18% 30%',
      '--input': '231 18% 30%',
      '--ring': '220 83% 75%',
      '--foreground': '228 67% 88%',
    },
  },
  {
    id: 'nord',
    name: 'Nord Frost',
    background: '#2e3440',
    panelBackground: '#3b4252',
    accent: '#88c0d0',
    foreground: '#eceff4',
    cssVars: {
      '--background': '220 16% 22%',
      '--sidebar': '220 16% 19%',
      '--card': '220 16% 26%',
      '--popover': '220 16% 26%',
      '--primary': '193 43% 67%',
      '--primary-foreground': '220 16% 22%',
      '--secondary': '220 16% 32%',
      '--secondary-foreground': '218 27% 94%',
      '--muted': '220 16% 32%',
      '--muted-foreground': '218 12% 70%',
      '--accent': '220 16% 35%',
      '--accent-foreground': '218 27% 94%',
      '--border': '220 16% 34%',
      '--input': '220 16% 34%',
      '--ring': '193 43% 67%',
      '--foreground': '218 27% 94%',
    },
  },
  {
    id: 'onedark',
    name: 'Atom One Dark',
    background: '#21252b',
    panelBackground: '#282c34',
    accent: '#61afef',
    foreground: '#abb2bf',
    cssVars: {
      '--background': '220 13% 15%',
      '--sidebar': '220 13% 13%',
      '--card': '220 13% 18%',
      '--popover': '220 13% 18%',
      '--primary': '207 82% 66%',
      '--primary-foreground': '220 13% 15%',
      '--secondary': '220 13% 24%',
      '--secondary-foreground': '219 14% 78%',
      '--muted': '220 13% 24%',
      '--muted-foreground': '219 10% 58%',
      '--accent': '220 13% 27%',
      '--accent-foreground': '219 14% 85%',
      '--border': '220 13% 25%',
      '--input': '220 13% 25%',
      '--ring': '207 82% 66%',
      '--foreground': '219 14% 82%',
    },
  },
  {
    id: 'tokyonight',
    name: 'Tokyo Night',
    background: '#1a1b26',
    panelBackground: '#24283b',
    accent: '#7aa2f7',
    foreground: '#a9b1d6',
    cssVars: {
      '--background': '235 19% 13%',
      '--sidebar': '235 19% 11%',
      '--card': '231 24% 18%',
      '--popover': '231 24% 18%',
      '--primary': '221 89% 72%',
      '--primary-foreground': '235 19% 13%',
      '--secondary': '231 20% 26%',
      '--secondary-foreground': '228 38% 82%',
      '--muted': '231 20% 26%',
      '--muted-foreground': '228 20% 60%',
      '--accent': '231 20% 29%',
      '--accent-foreground': '228 38% 85%',
      '--border': '231 20% 26%',
      '--input': '231 20% 26%',
      '--ring': '221 89% 72%',
      '--foreground': '228 38% 82%',
    },
  },
  {
    id: 'light',
    name: 'Paper Light',
    background: '#F7F6F2',
    panelBackground: '#FFFFFF',
    accent: '#121214',
    foreground: '#0E0E10',
    cssVars: {
      '--background': '45 18% 96.5%',
      '--sidebar': '45 14% 94%',
      '--card': '0 0% 100%',
      '--popover': '0 0% 100%',
      '--primary': '240 5% 7%',
      '--primary-foreground': '48 14% 94%',
      '--secondary': '45 10% 91%',
      '--secondary-foreground': '240 6% 12%',
      '--muted': '45 10% 92%',
      '--muted-foreground': '240 4% 42%',
      '--accent': '45 10% 90%',
      '--accent-foreground': '240 6% 8%',
      '--border': '40 8% 85%',
      '--input': '40 8% 84%',
      '--ring': '240 5% 18%',
      '--foreground': '240 6% 6%',
    },
  },
];

export function applyTheme(themeId: ThemeName) {
  if (typeof document === 'undefined') return;
  const theme = themeCatalog.find((t) => t.id === themeId) || themeCatalog[0];
  const root = document.documentElement;

  root.classList.remove('light', 'dark');
  if (themeId === 'light') {
    root.classList.add('light');
  } else {
    root.classList.add('dark');
  }

  Object.entries(theme.cssVars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
}

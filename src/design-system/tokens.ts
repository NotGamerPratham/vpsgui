export type ThemeName = 'vscode_dark' | 'dracula' | 'catppuccin' | 'nord' | 'onedark' | 'tokyonight' | 'light';

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
    id: 'vscode_dark',
    name: 'VS Code Dark (Default)',
    background: '#0B0F19',
    panelBackground: '#1E293B',
    accent: '#3B82F6',
    foreground: '#F8FAFC',
    cssVars: {
      '--background': '222.2 84% 4.9%',
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
    name: 'Dracula Cyber',
    background: '#282a36',
    panelBackground: '#44475a',
    accent: '#bd93f9',
    foreground: '#f8f8f2',
    cssVars: {
      '--background': '231 15% 18%',
      '--card': '232 14% 24%',
      '--popover': '232 14% 24%',
      '--primary': '265 89% 78%',
      '--primary-foreground': '231 15% 18%',
      '--secondary': '232 14% 31%',
      '--secondary-foreground': '60 30% 96%',
      '--muted': '232 14% 31%',
      '--muted-foreground': '228 13% 75%',
      '--accent': '326 100% 74%',
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
      '--card': '231 18% 26%',
      '--popover': '231 18% 26%',
      '--primary': '220 83% 75%',
      '--primary-foreground': '232 23% 18%',
      '--secondary': '231 18% 30%',
      '--secondary-foreground': '228 67% 88%',
      '--muted': '231 18% 30%',
      '--muted-foreground': '229 23% 75%',
      '--accent': '316 73% 84%',
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
      '--card': '220 16% 28%',
      '--popover': '220 16% 28%',
      '--primary': '193 43% 67%',
      '--primary-foreground': '220 16% 22%',
      '--secondary': '220 16% 34%',
      '--secondary-foreground': '218 27% 94%',
      '--muted': '220 16% 34%',
      '--muted-foreground': '218 12% 70%',
      '--accent': '193 43% 67%',
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
      '--card': '220 13% 18%',
      '--popover': '220 13% 18%',
      '--primary': '207 82% 66%',
      '--primary-foreground': '220 13% 15%',
      '--secondary': '220 13% 25%',
      '--secondary-foreground': '219 14% 71%',
      '--muted': '220 13% 25%',
      '--muted-foreground': '219 10% 55%',
      '--accent': '207 82% 66%',
      '--accent-foreground': '219 14% 71%',
      '--border': '220 13% 25%',
      '--input': '220 13% 25%',
      '--ring': '207 82% 66%',
      '--foreground': '219 14% 71%',
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
      '--card': '231 24% 19%',
      '--popover': '231 24% 19%',
      '--primary': '221 89% 72%',
      '--primary-foreground': '235 19% 13%',
      '--secondary': '231 20% 28%',
      '--secondary-foreground': '228 38% 75%',
      '--muted': '231 20% 28%',
      '--muted-foreground': '228 20% 60%',
      '--accent': '257 88% 78%',
      '--accent-foreground': '228 38% 75%',
      '--border': '231 20% 28%',
      '--input': '231 20% 28%',
      '--ring': '221 89% 72%',
      '--foreground': '228 38% 75%',
    },
  },
  {
    id: 'light',
    name: 'Clean Light',
    background: '#f8fafc',
    panelBackground: '#ffffff',
    accent: '#2563eb',
    foreground: '#0f172a',
    cssVars: {
      '--background': '0 0% 100%',
      '--card': '0 0% 100%',
      '--popover': '0 0% 100%',
      '--primary': '221.2 83.2% 53.3%',
      '--primary-foreground': '210 40% 98%',
      '--secondary': '210 40% 96.1%',
      '--secondary-foreground': '222.2 47.4% 11.2%',
      '--muted': '210 40% 96.1%',
      '--muted-foreground': '215.4 16.3% 46.9%',
      '--accent': '210 40% 96.1%',
      '--accent-foreground': '222.2 47.4% 11.2%',
      '--border': '214.3 31.8% 91.4%',
      '--input': '214.3 31.8% 91.4%',
      '--ring': '221.2 83.2% 53.3%',
      '--foreground': '222.2 84% 4.9%',
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

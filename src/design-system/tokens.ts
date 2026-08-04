export type ThemeName = 'vscode_dark' | 'dracula' | 'catppuccin' | 'nord' | 'onedark' | 'tokyonight' | 'light';

export interface ThemeDefinition {
  id: ThemeName;
  name: string;
  background: string;
  panelBackground: string;
  accent: string;
  foreground: string;
}

export const themeCatalog: ThemeDefinition[] = [
  {
    id: 'vscode_dark',
    name: 'VS Code Dark (Default)',
    background: '#0B0F19',
    panelBackground: '#1E293B',
    accent: '#3B82F6',
    foreground: '#F8FAFC',
  },
  {
    id: 'dracula',
    name: 'Dracula',
    background: '#282a36',
    panelBackground: '#44475a',
    accent: '#bd93f9',
    foreground: '#f8f8f2',
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin Macchiato',
    background: '#24273a',
    panelBackground: '#363a4f',
    accent: '#8aadf4',
    foreground: '#cad3f5',
  },
  {
    id: 'nord',
    name: 'Nord Frost',
    background: '#2e3440',
    panelBackground: '#3b4252',
    accent: '#88c0d0',
    foreground: '#eceff4',
  },
  {
    id: 'onedark',
    name: 'Atom One Dark',
    background: '#21252b',
    panelBackground: '#282c34',
    accent: '#61afef',
    foreground: '#abb2bf',
  },
  {
    id: 'tokyonight',
    name: 'Tokyo Night',
    background: '#1a1b26',
    panelBackground: '#24283b',
    accent: '#7aa2f7',
    foreground: '#a9b1d6',
  },
  {
    id: 'light',
    name: 'Clean Light',
    background: '#f8fafc',
    panelBackground: '#ffffff',
    accent: '#2563eb',
    foreground: '#0f172a',
  },
];

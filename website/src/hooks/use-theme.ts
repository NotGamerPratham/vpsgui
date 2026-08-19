import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'vpsgui-site-theme';

function readStoredTheme(): Theme {
  // Must agree with the inline script in index.html, which applies the class
  // before React mounts to avoid a white flash on a dark page.
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    if (stored === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  } catch {
    // Private browsing denies localStorage. Fall through to the default.
  }
  return 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.backgroundColor = theme === 'dark' ? '#060910' : '#ffffff';
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Nothing to do; the class is applied either way for this session.
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, setTheme, toggle };
}

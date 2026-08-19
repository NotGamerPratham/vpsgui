import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'vpsgui-site-theme';
const DEFAULT_THEME: Theme = 'dark';

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    if (stored === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  } catch {
    // Private browsing denies localStorage. Fall through to the default.
  }
  return DEFAULT_THEME;
}

/**
 * `null` until the stored preference has been adopted after mount.
 *
 * Reading localStorage during render would make the client disagree with the
 * prerendered HTML, which is a hydration mismatch. The inline script in
 * index.html has already put the right class on <html> by then, so the only
 * thing deferred is which icon the toggle shows — not the page's appearance.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  useEffect(() => {
    if (theme === null) return;

    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.backgroundColor = theme === 'dark' ? '#161616' : '#f3f3f3';

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Nothing to do; the class is applied either way for this session.
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => ((current ?? DEFAULT_THEME) === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme: theme ?? DEFAULT_THEME, setTheme, toggle };
}

'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  mounted: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  mounted: false,
  toggleTheme: () => {},
});

function applyThemeToDocument(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.toggle('dark-mode', theme === 'dark');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('mineos-theme') as Theme | null;
      const resolved: Theme = stored === 'dark' ? 'dark' : 'light';
      setTheme(resolved);
      applyThemeToDocument(resolved);
    } catch {
      applyThemeToDocument('light');
    }
    setMounted(true);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      applyThemeToDocument(next);
      try {
        localStorage.setItem('mineos-theme', next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, mounted, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

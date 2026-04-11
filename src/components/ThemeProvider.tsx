'use client';

import { useEffect } from 'react';

const THEMES: Record<string, { primary: string; secondary: string; accent: string }> = {
  ocean:   { primary: '#0ea5e9', secondary: '#a855f7', accent: '#ec4899' },
  violet:  { primary: '#8b5cf6', secondary: '#6366f1', accent: '#a855f7' },
  rose:    { primary: '#e11d48', secondary: '#f43f5e', accent: '#fb7185' },
  emerald: { primary: '#10b981', secondary: '#059669', accent: '#34d399' },
  amber:   { primary: '#f59e0b', secondary: '#d97706', accent: '#fbbf24' },
};

/**
 * Applies the saved accent-color theme and ensures ONLY light mode is active.
 * Neutralized dark mode functionality to respect the high-key design strategy.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Apply saved theme on first load
    applyTheme(localStorage.getItem('smilesync_theme') || 'ocean');
    
    // Check and apply Dark Mode preference
    const isDark = localStorage.getItem('smilesync_dark') === 'true';
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.body.classList.remove('dark');
    }

    // Listen for live theme changes
    const themeHandler = (e: Event) => {
      const themeId = (e as CustomEvent<string>).detail;
      applyTheme(themeId);
    };
    
    // Listen for live dark mode changes
    const darkHandler = (e: Event) => {
      const isDarkNow = (e as CustomEvent<boolean>).detail;
      if (isDarkNow) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
        document.body.classList.remove('dark');
      }
    };

    window.addEventListener('smilesync:theme-change', themeHandler);
    window.addEventListener('smilesync:dark-change', darkHandler);
    return () => {
      window.removeEventListener('smilesync:theme-change', themeHandler);
      window.removeEventListener('smilesync:dark-change', darkHandler);
    };
  }, []);

  return <>{children}</>;
}

function applyTheme(themeId: string) {
  const theme = THEMES[themeId];
  if (!theme) return;
  const root = document.documentElement;
  root.style.setProperty('--primary', theme.primary);
  root.style.setProperty('--primary-container', theme.secondary);
  root.style.setProperty('--accent', theme.accent);
}

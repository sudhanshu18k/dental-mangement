'use client';

import { useEffect } from 'react';
import { useStore } from '@/store';

const THEMES: Record<string, { primary: string; secondary: string; accent: string }> = {
  ocean:   { primary: '#0ea5e9', secondary: '#a855f7', accent: '#ec4899' },
  violet:  { primary: '#8b5cf6', secondary: '#6366f1', accent: '#a855f7' },
  rose:    { primary: '#e11d48', secondary: '#f43f5e', accent: '#fb7185' },
  emerald: { primary: '#10b981', secondary: '#059669', accent: '#34d399' },
  amber:   { primary: '#f59e0b', secondary: '#d97706', accent: '#fbbf24' },
};

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { activeClinic } = useStore();

  useEffect(() => {
    // Determine the theme color (Clinic override or local preference)
    if (activeClinic?.primaryColor) {
      applyCustomBrand(activeClinic.primaryColor);
    } else {
      applyTheme(localStorage.getItem('smilesync_theme') || 'ocean');
    }
    
    // Admin Settings Dark Mode preference (per browser)
    const isDark = localStorage.getItem('smilesync_dark') === 'true';
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.body.classList.remove('dark');
    }

    // Listen for live theme changes in settings (if they change local generic theme)
    const themeHandler = (e: Event) => {
      if (!activeClinic?.primaryColor) {
        const themeId = (e as CustomEvent<string>).detail;
        applyTheme(themeId);
      }
    };
    
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
  }, [activeClinic]);

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

function applyCustomBrand(hexColor: string) {
  const root = document.documentElement;
  root.style.setProperty('--primary', hexColor);
  // Just use the primary for container and accent for now or derive them
  root.style.setProperty('--primary-container', hexColor);
  root.style.setProperty('--accent', hexColor);
}

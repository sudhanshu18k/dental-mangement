'use client';

import { useEffect } from 'react';

const THEMES: Record<string, { primary: string; secondary: string; accent: string }> = {
  ocean:   { primary: '#0061a3', secondary: '#4da8ff', accent: '#6EE7FF' },
  aqua:    { primary: '#008575', secondary: '#b3f0e0', accent: '#2ab3ca' },
  violet:  { primary: '#6750a4', secondary: '#eaddff', accent: '#21005d' },
};

/**
 * Applies the saved accent-color theme and ensures ONLY light mode is active.
 * Neutralized dark mode functionality to respect the high-key design strategy.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Apply saved theme on first load
    applyTheme(localStorage.getItem('smilesync_theme') || 'ocean');
    
    // Force Light Mode - The strategy is strictly High-Key
    document.documentElement.removeAttribute('data-theme');
    document.body.classList.remove('dark');
    localStorage.setItem('smilesync_dark', 'false');

    // Listen for live theme changes
    const themeHandler = (e: Event) => {
      const themeId = (e as CustomEvent<string>).detail;
      applyTheme(themeId);
    };
    
    // Listen for live dark mode changes - Ignore them to maintain high-key
    const darkHandler = () => {
      console.log("Dark mode is disabled by Liquid Crystal Strategy.");
      document.documentElement.removeAttribute('data-theme');
      document.body.classList.remove('dark');
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

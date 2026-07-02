import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('pb_theme') !== 'light');

  useEffect(() => {
    localStorage.setItem('pb_theme', darkMode ? 'dark' : 'light');
    const root = document.documentElement;
    if (darkMode) {
      root.classList.remove('light');
      document.body.style.background = '#0A0B0D';
      root.style.setProperty('--theme-bg', '#0A0B0D');
      root.style.setProperty('--theme-surface', '#181A1C');
      root.style.setProperty('--theme-surface-alt', '#212326');
      root.style.setProperty('--theme-ink', '#F5F5F0');
      root.style.setProperty('--theme-ink-soft', '#848A8F');
      root.style.setProperty('--theme-border', '#2C2F33');
      root.style.setProperty('--theme-accent', '#00C853');
    } else {
      root.classList.add('light');
      document.body.style.background = '#F5F5F0';
      root.style.setProperty('--theme-bg', '#F5F5F0');
      root.style.setProperty('--theme-surface', '#E3E5E8');
      root.style.setProperty('--theme-surface-alt', '#F5F5F0');
      root.style.setProperty('--theme-ink', '#111316');
      root.style.setProperty('--theme-ink-soft', '#5A6068');
      root.style.setProperty('--theme-border', '#C8CBD0');
      root.style.setProperty('--theme-accent', '#00C853');
    }
  }, [darkMode]);

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
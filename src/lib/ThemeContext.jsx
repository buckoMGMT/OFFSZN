import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('pb_theme') === 'dark');

  useEffect(() => {
    localStorage.setItem('pb_theme', darkMode ? 'dark' : 'light');
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      document.body.style.background = '#0D0D0F';
      root.style.setProperty('--theme-bg', '#0D0D0F');
      root.style.setProperty('--theme-surface', '#1B1B1D');
      root.style.setProperty('--theme-surface-alt', '#272729');
      root.style.setProperty('--theme-ink', '#EDEEF0');
      root.style.setProperty('--theme-ink-soft', '#9BA3AC');
      root.style.setProperty('--theme-border', '#5E646B');
    } else {
      root.classList.remove('dark');
      document.body.style.background = '#EDEEF0';
      root.style.setProperty('--theme-bg', '#EDEEF0');
      root.style.setProperty('--theme-surface', '#DCDEE1');
      root.style.setProperty('--theme-surface-alt', '#EDEEF0');
      root.style.setProperty('--theme-ink', '#15151A');
      root.style.setProperty('--theme-ink-soft', '#5A5D63');
      root.style.setProperty('--theme-border', '#9BA3AC');
    }
  }, [darkMode]);

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Dark is the default — the design target
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('pb_theme') !== 'light');

  useEffect(() => {
    localStorage.setItem('pb_theme', darkMode ? 'dark' : 'light');
    const root = document.documentElement;

    if (darkMode) {
      root.classList.remove('light');
      document.body.style.background = 'var(--surface-0)';
    } else {
      root.classList.add('light');
      document.body.style.background = 'var(--surface-0)';
    }
  }, [darkMode]);

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
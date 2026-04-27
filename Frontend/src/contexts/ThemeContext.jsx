import { createContext, useContext, useEffect, useState } from 'react';
import { THEMES, DEFAULT_THEME } from '../themes/index.js';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem('cradlehq-theme') ?? DEFAULT_THEME
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cradlehq-theme', theme);
  }, [theme]);

  function setTheme(id) {
    setThemeState(id);
  }

  const themeConfig = THEMES.find(t => t.id === theme) ?? THEMES[0];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themeConfig }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

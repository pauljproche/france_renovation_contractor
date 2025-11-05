import { createContext, useContext, useState, useEffect } from 'react';

// Language Context
const LanguageContext = createContext(undefined);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en');

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'fr' : 'en'));
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}

// Role Context
const RoleContext = createContext(undefined);

export const ROLES = {
  CONTRACTOR: 'contractor',
  CLIENT: 'client',
  ARCHITECT: 'architect'
};

export function RoleProvider({ children }) {
  const [role, setRole] = useState(ROLES.CONTRACTOR);

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within RoleProvider');
  }
  return context;
}

// AI Panel Visibility Context
const AIPanelContext = createContext(undefined);

export function AIPanelProvider({ children }) {
  // Check if user just logged in (sessionStorage indicates fresh login)
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(() => {
    // Check if this is a fresh login
    const justLoggedIn = sessionStorage.getItem('justLoggedIn');
    if (justLoggedIn === 'true') {
      // Clear the flag and open the panel
      sessionStorage.removeItem('justLoggedIn');
      return true; // Open after login
    }
    // Otherwise check localStorage for previous preference
    const saved = localStorage.getItem('aiPanelOpen');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleAIPanel = () => {
    setIsAIPanelOpen((prev) => {
      const newValue = !prev;
      // Save preference to localStorage
      localStorage.setItem('aiPanelOpen', newValue.toString());
      return newValue;
    });
  };

  return (
    <AIPanelContext.Provider value={{ isAIPanelOpen, setIsAIPanelOpen, toggleAIPanel }}>
      {children}
    </AIPanelContext.Provider>
  );
}

export function useAIPanel() {
  const context = useContext(AIPanelContext);
  if (context === undefined) {
    throw new Error('useAIPanel must be used within AIPanelProvider');
  }
  return context;
}

// Theme Context
const ThemeContext = createContext(undefined);

export const THEMES = {
  PURPLE: 'purple',
  BLUE: 'blue'
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved || THEMES.PURPLE; // Default to purple
  });

  const setThemeAndSave = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    // Apply theme class to body
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${newTheme}`);
  };

  // Apply theme on mount
  useEffect(() => {
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeAndSave }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}


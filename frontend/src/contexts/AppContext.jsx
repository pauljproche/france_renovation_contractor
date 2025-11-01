import { createContext, useContext, useState } from 'react';

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


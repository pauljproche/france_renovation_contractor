import { useState, useEffect, useRef } from 'react';
import { useRole, ROLES, useLanguage, useAIPanel } from '../contexts/AppContext.jsx';
import { useProjects } from '../contexts/ProjectsContext.jsx';
import { useTranslation } from '../hooks/useTranslation.js';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useChatHistory } from '../contexts/ChatHistoryContext.jsx';

function RoleSwitcher() {
  const { role, setRole } = useRole();
  const { t } = useTranslation();

  return (
    <div className="role-switcher">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="role-select"
      >
        <option value={ROLES.CONTRACTOR}>{t('roleContractor')}</option>
        <option value={ROLES.CLIENT}>{t('roleClient')}</option>
        <option value={ROLES.ARCHITECT}>{t('roleArchitect')}</option>
      </select>
    </div>
  );
}

function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();
  
  return (
    <button
      onClick={toggleLanguage}
      type="button"
      className="language-toggle-btn"
      title={language === 'en' ? 'Switch to French' : 'Passer en anglais'}
    >
      {language === 'en' ? '🇬🇧 EN' : '🇫🇷 FR'}
    </button>
  );
}

function Breadcrumbs() {
  const location = useLocation();
  const { t } = useTranslation();

  const pathMap = {
    '/global-dashboard': t('globalDashboardTitle'),
    '/settings': t('settings'),
    '/dashboard': t('navDashboard'),
    '/materials': t('navMaterials'),
    '/chat-history': t('navChatHistory')
  };

  const path = location.pathname;
  const label = pathMap[path] || path;

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <span className="breadcrumb-current">
        {label}
      </span>
    </nav>
  );
}

export default function TopBar() {
  const { t } = useTranslation();
  const { isAIPanelOpen, toggleAIPanel } = useAIPanel();
  const { projects } = useProjects();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const profileMenuRef = useRef(null);
  
  const isGlobalDashboard = location.pathname === '/global-dashboard';
  const isSettings = location.pathname === '/settings';
  const isTrackingPage = ['/dashboard', '/materials', '/chat-history'].includes(location.pathname);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);
  
  const { clearHistory } = useChatHistory();
  
  const handleLogout = () => {
    sessionStorage.removeItem('authenticated');
    sessionStorage.removeItem('username');
    localStorage.removeItem('aiPanelOpen');
    clearHistory(); // Clear chat history on logout
    navigate('/');
  };

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <Link to="/">
          <h1 className="top-bar-logo">{t('appTitle')}</h1>
        </Link>
        <Breadcrumbs />
      </div>
      <div className="top-bar-right">
        {isTrackingPage && (
          <Link
            to="/global-dashboard"
            className="top-bar-link"
          >
            {t('navProjects')}
          </Link>
        )}
        <RoleSwitcher />
        <LanguageToggle />
        {!isGlobalDashboard && (
          <button 
            className="ai-toggle-btn" 
            type="button" 
            title={isAIPanelOpen ? 'Masquer l\'assistant IA' : 'Afficher l\'assistant IA'}
            onClick={toggleAIPanel}
          >
          {isAIPanelOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              <circle cx="18" cy="6" r="4" fill="currentColor"/>
            </svg>
          )}
          </button>
        )}
        <div className="profile-menu" ref={profileMenuRef}>
          <button 
            className="profile-btn" 
            type="button" 
            title={t('profile')}
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4"/>
              <path d="M20 21c0-4.418-3.582-8-8-8s-8 3.582-8 8"/>
            </svg>
          </button>
          {showProfileMenu && (
            <div className="profile-dropdown">
              <button 
                type="button"
                className="profile-dropdown-item"
                onClick={handleLogout}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                </svg>
                {t('logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}


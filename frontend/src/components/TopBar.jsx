import { useState, useEffect, useRef } from 'react';
import { useRole, ROLES, useLanguage, useAIPanel } from '../contexts/AppContext.jsx';
import { useProjects } from '../contexts/ProjectsContext.jsx';
import { useTranslation } from '../hooks/useTranslation.js';
import { useLocation, Link, useNavigate } from 'react-router-dom';

function RoleSwitcher() {
  const { role, setRole, customRoles, addCustomRole, removeCustomRole } = useRole();
  const { t } = useTranslation();
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleAddRole = () => {
    setError('');
    if (newRoleName.trim()) {
      const success = addCustomRole(newRoleName.trim());
      if (success) {
        setNewRoleName('');
        setShowAddRole(false);
      } else {
        setError(t('roleAlreadyExists') || 'This role already exists');
      }
    } else {
      setError(t('roleNameRequired') || 'Please enter a role name');
    }
  };

  const handleRemoveRoleClick = (e, roleToDelete) => {
    e.stopPropagation();
    setRoleToDelete(roleToDelete);
    setDeleteConfirmText('');
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (!roleToDelete) return;
    
    if (deleteConfirmText.trim() === roleToDelete.name) {
      removeCustomRole(roleToDelete.id);
      setShowDeleteConfirm(false);
      setRoleToDelete(null);
      setDeleteConfirmText('');
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setRoleToDelete(null);
    setDeleteConfirmText('');
  };

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
        <option value={ROLES.ALEXIS_ROCHE}>{t('roleAlexisRoche') || 'Alexis Roche'}</option>
        <option value={ROLES.PAUL_ROCHE}>{t('rolePaulRoche') || 'Paul Roche'}</option>
        {customRoles.map((customRole) => (
          <option key={customRole.id} value={customRole.id}>
            {customRole.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          setShowAddRole(!showAddRole);
          setError('');
          setNewRoleName('');
        }}
        className="add-role-btn"
        title={t('addRole') || 'Add Role'}
      >
        +
      </button>
      {showAddRole && (
        <div className="add-role-dropdown">
          <input
            type="text"
            value={newRoleName}
            onChange={(e) => {
              setNewRoleName(e.target.value);
              setError('');
            }}
            placeholder={t('enterRoleName') || 'Enter role name...'}
            className="add-role-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddRole();
              } else if (e.key === 'Escape') {
                setShowAddRole(false);
                setNewRoleName('');
                setError('');
              }
            }}
            autoFocus
          />
          {error && (
            <div className="add-role-error">
              {error}
            </div>
          )}
          <div className="add-role-actions">
            <button
              type="button"
              onClick={handleAddRole}
              className="add-role-confirm-btn"
            >
              {t('add') || 'Add'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddRole(false);
                setNewRoleName('');
                setError('');
              }}
              className="add-role-cancel-btn"
            >
              {t('cancel') || 'Cancel'}
            </button>
          </div>
          {customRoles.length > 0 && (
            <div className="custom-roles-list">
              <div className="custom-roles-header">
                {t('customRoles') || 'Custom Roles'}
              </div>
              {customRoles.map((customRole) => (
                <div key={customRole.id} className="custom-role-item">
                  <span>{customRole.name}</span>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveRoleClick(e, customRole)}
                    className="remove-role-btn"
                    title={t('removeRole') || 'Remove role'}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {showDeleteConfirm && roleToDelete && (
        <div className="delete-role-modal-overlay" onClick={handleCancelDelete}>
          <div className="delete-role-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('confirmDeleteRole') || 'Are you sure?'}</h3>
            <p>
              {(t('typeRoleNameToConfirm') || 'Type {roleName} to confirm:')
                .replace('{roleName}', roleToDelete.name)}
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={roleToDelete.name}
              className="delete-role-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && deleteConfirmText.trim() === roleToDelete.name) {
                  handleConfirmDelete();
                } else if (e.key === 'Escape') {
                  handleCancelDelete();
                }
              }}
              autoFocus
            />
            <div className="delete-role-actions">
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="delete-role-confirm-btn"
                disabled={deleteConfirmText.trim() !== roleToDelete.name}
              >
                {t('confirmDelete') || 'Confirm Delete'}
              </button>
              <button
                type="button"
                onClick={handleCancelDelete}
                className="delete-role-cancel-btn"
              >
                {t('cancel') || 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
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
    '/chat-history': t('navChatHistory'),
    '/create-devis': t('navCreateDevis') || 'Create Devis'
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
  
  const handleLogout = () => {
    // Get username before removing it
    const username = sessionStorage.getItem('username');
    // Save current AI panel session before logout
    try {
      const sessionsKey = username ? `ai-panel-sessions-${username}` : 'ai-panel-sessions-guest';
      const currentSessionKey = username ? `ai-panel-current-session-${username}` : 'ai-panel-current-session-guest';
      const sessionId = sessionStorage.getItem(currentSessionKey);
      
      // The session will be saved automatically when component unmounts
      // But we'll clear the current session ID so a new one starts on next login
      sessionStorage.removeItem(currentSessionKey);
    } catch (e) {
      // Ignore errors
    }
    sessionStorage.removeItem('authenticated');
    sessionStorage.removeItem('username');
    localStorage.removeItem('aiPanelOpen');
    // Don't clear chat history on logout - it's user-specific and persists
    // Sessions are also preserved per user
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


import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation.js';
import { useLanguage } from '../contexts/AppContext.jsx';
import { useChatHistory } from '../contexts/ChatHistoryContext.jsx';

function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();
  
  return (
    <button
      onClick={toggleLanguage}
      type="button"
      className="login-nav-lang-btn"
      title={language === 'en' ? 'Switch to French' : 'Passer en anglais'}
    >
      {language === 'en' ? '🇬🇧 EN' : '🇫🇷 FR'}
    </button>
  );
}

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { clearHistory } = useChatHistory();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Clear all authentication and user data on mount for fresh start
  useEffect(() => {
    // Clear sessionStorage (authentication data)
    sessionStorage.removeItem('authenticated');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('justLoggedIn');
    
    // Clear localStorage (user preferences and project data)
    localStorage.removeItem('renovationProjects');
    localStorage.removeItem('convertedDemoProjects');
    localStorage.removeItem('selectedProjectId');
    localStorage.removeItem('hiddenFromRegularDemos');
    localStorage.removeItem('aiPanelOpen');
    
    // Clear chat history on login page mount
    clearHistory();
  }, [clearHistory]); // Run once on mount

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    // Simple authentication - in production, this would check against a database
    if (username && password) {
      setLoading(true);
      
      // Store auth state (in production, use proper auth tokens)
      sessionStorage.setItem('authenticated', 'true');
      sessionStorage.setItem('username', username);
      sessionStorage.setItem('justLoggedIn', 'true');
      
      // Clear any existing project data to give each user a fresh dashboard
      // In production, this would be user-specific data from a database
      localStorage.removeItem('renovationProjects');
      localStorage.removeItem('convertedDemoProjects');
      localStorage.removeItem('selectedProjectId');
      // Clear hiddenFromRegularDemos so main demo shows in regular projects by default
      localStorage.removeItem('hiddenFromRegularDemos');
      
      // Clear chat history on login
      clearHistory();
      
      // Add 1.5 second delay before navigating to projects dashboard
      setTimeout(() => {
        navigate('/global-dashboard');
      }, 1500);
    } else {
      setError('Please enter both username and password');
    }
  };

  return (
    <div className="login-page">
      <header className="login-nav">
        <div className="login-nav-content">
          <a href="/" className="login-nav-logo">
            {t('appTitle')}
          </a>
          <LanguageToggle />
        </div>
      </header>

      <div className="login-container">
        <div className="login-card">
          <h1>{t('loginTitle')}</h1>
          <p className="login-subtitle">{t('loginSubtitle')}</p>
          
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="username">{t('loginUsername')}</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('loginUsernamePlaceholder')}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">{t('loginPassword')}</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('loginPasswordPlaceholder')}
              />
            </div>
            
            {error && <p className="login-error">{error}</p>}
            
            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading ? t('loginSigningIn') : t('loginButton')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}


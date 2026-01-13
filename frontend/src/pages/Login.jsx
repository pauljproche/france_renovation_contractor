import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    if (!username || !password) {
      setError('Please enter both email and password');
      setLoading(false);
      return;
    }

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: username,
          password: password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Invalid email or password' }));
        throw new Error(errorData.detail || 'Invalid email or password');
      }

      const data = await response.json();
      const user = data.user;

      // Store auth state
      sessionStorage.setItem('authenticated', 'true');
      sessionStorage.setItem('username', user.email);
      sessionStorage.setItem('userId', user.id);
      sessionStorage.setItem('userRole', user.role);
      sessionStorage.setItem('justLoggedIn', 'true');
      
      // Clear any existing project data to give each user a fresh dashboard
      localStorage.removeItem('renovationProjects');
      localStorage.removeItem('convertedDemoProjects');
      localStorage.removeItem('selectedProjectId');
      localStorage.removeItem('hiddenFromRegularDemos');
      
      // Clear chat history on login
      clearHistory();
      
      // Navigate to projects dashboard
      navigate('/global-dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
      setLoading(false);
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
              <label htmlFor="username">Email</label>
              <input
                type="email"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your email"
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

            <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>
              Don't have an account?{' '}
              <Link to="/signup" style={{ color: '#007bff', textDecoration: 'none' }}>
                Sign up
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}


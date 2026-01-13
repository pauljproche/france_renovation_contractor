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

export default function SignUp() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { clearHistory } = useChatHistory();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'client' // Default role for public sign-ups
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/api/users/roles`);
      if (response.ok) {
        const data = await response.json();
        // Filter out admin role for public sign-up
        setRoles(data.roles.filter(role => role !== 'admin'));
      }
    } catch (err) {
      console.error('Error loading roles:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Validation
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 4) {
      setError('Password must be at least 4 characters');
      setLoading(false);
      return;
    }

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/api/users/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          role: formData.role.toLowerCase(), // Normalize to lowercase
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Sign up failed' }));
        throw new Error(errorData.detail || 'Sign up failed');
      }

      const data = await response.json();
      
      // Show success message and redirect to login
      setError('');
      alert('Account created successfully! Please log in.');
      navigate('/login');
    } catch (err) {
      setError(err.message || 'Sign up failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <header className="login-nav">
        <div className="login-nav-content">
          <Link to="/" className="login-nav-logo">
            {t('appTitle')}
          </Link>
          <LanguageToggle />
        </div>
      </header>

      <div className="login-container">
        <div className="login-card">
          <h1>Create Account</h1>
          <p className="login-subtitle">Sign up to get started with Renovation Control</p>
          
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter your email"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                type="password"
                id="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Create a password"
                required
                minLength={4}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                type="password"
                id="confirmPassword"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Confirm your password"
                required
                minLength={4}
              />
            </div>

            <div className="form-group">
              <label htmlFor="role">I am a *</label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            
            {error && <p className="login-error">{error}</p>}
            
            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

            <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#007bff', textDecoration: 'none' }}>
                Log in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

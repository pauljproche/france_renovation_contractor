import { Link } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation.js';
import { useLanguage } from '../contexts/AppContext.jsx';
import landingPhoto from '../assets/landingpagephoto.png';
import howItWorksScreenshot from '../assets/how-it-works-screenshot.png';

function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();
  
  return (
    <button
      onClick={toggleLanguage}
      type="button"
      className="landing-nav-lang-btn"
      title={language === 'en' ? 'Switch to French' : 'Passer en anglais'}
    >
      {language === 'en' ? '🇬🇧 EN' : '🇫🇷 FR'}
    </button>
  );
}

export default function Landing() {
  const { t } = useTranslation();

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <div className="landing-nav-content">
          <Link to="/" className="landing-nav-logo">
            {t('appTitle')}
          </Link>
          <nav className="landing-nav-links">
            <Link to="/global-dashboard" className="landing-nav-link">
              {t('globalDashboardTitle')}
            </Link>
            <LanguageToggle />
          </nav>
        </div>
      </header>
      
      <div className="landing-hero">
        <div className="landing-content">
          <h1 className="landing-title">
            {t('landingTitle')}
          </h1>
          <Link to="/login" className="landing-hero-image">
            <img src={landingPhoto} alt="Renovation team collaboration" />
          </Link>
          <p className="landing-subtitle">
            {t('landingSubtitle')}
          </p>
          
          <div className="landing-cta">
            <Link to="/login" className="cta-button primary">
              {t('landingGetStarted')}
            </Link>
            <a href="#learn-more" className="cta-button secondary">
              {t('landingLearnMore')}
            </a>
          </div>
        </div>
      </div>

      <div id="learn-more" className="landing-details">
        <div className="landing-content">
          <h2>{t('landingHowItWorks')}</h2>
          <Link to="/dashboard" className="landing-how-it-works-image">
            <img src={howItWorksScreenshot} alt="Dashboard interface example" />
          </Link>
          <div className="landing-steps">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3>{t('landingStep1Title')}</h3>
              <p>{t('landingStep1Desc')}</p>
            </div>
            <div className="step-card">
              <div className="step-number">2</div>
              <h3>{t('landingStep2Title')}</h3>
              <p>{t('landingStep2Desc')}</p>
            </div>
            <div className="step-card">
              <div className="step-number">3</div>
              <h3>{t('landingStep3Title')}</h3>
              <p>{t('landingStep3Desc')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="landing-benefits">
        <div className="landing-content">
          <h2>{t('landingBenefitsTitle')}</h2>
          <div className="benefits-grid">
            <div className="benefit-item">
              <div className="benefit-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <h3>{t('landingBenefit1Title')}</h3>
              <p>{t('landingBenefit1Desc')}</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h3>{t('landingBenefit2Title')}</h3>
              <p>{t('landingBenefit2Desc')}</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              </div>
              <h3>{t('landingBenefit3Title')}</h3>
              <p>{t('landingBenefit3Desc')}</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
              <h3>{t('landingBenefit4Title')}</h3>
              <p>{t('landingBenefit4Desc')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


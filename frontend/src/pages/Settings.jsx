import { useTranslation } from '../hooks/useTranslation.js';
import { useLanguage, useRole, ROLES, useTheme, THEMES } from '../contexts/AppContext.jsx';

export default function Settings() {
  const { t } = useTranslation();
  const { language, toggleLanguage } = useLanguage();
  const { role, setRole } = useRole();
  const { theme, setTheme } = useTheme();

  return (
    <div className="settings-page">
      <h1 className="settings-title">{t('settings')}</h1>
      
      <section className="settings-section">
        <h2 className="settings-section-title">{t('generalSettings')}</h2>
        
        <div className="settings-item">
          <label className="settings-label">{t('language')}</label>
          <div className="settings-control">
            <button
              onClick={toggleLanguage}
              type="button"
              className="settings-button"
            >
              {language === 'en' ? '🇬🇧 English' : '🇫🇷 Français'}
            </button>
          </div>
        </div>

        <div className="settings-item">
          <label className="settings-label">{t('role')}</label>
          <div className="settings-control">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="settings-select"
            >
              <option value={ROLES.CONTRACTOR}>{t('roleContractor')}</option>
              <option value={ROLES.CLIENT}>{t('roleClient')}</option>
              <option value={ROLES.ARCHITECT}>{t('roleArchitect')}</option>
            </select>
          </div>
        </div>

        <div className="settings-item">
          <label className="settings-label">{t('theme')}</label>
          <div className="settings-control">
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="settings-select"
            >
              <option value={THEMES.PURPLE}>{t('themePurple')}</option>
              <option value={THEMES.BLUE}>{t('themeBlue')}</option>
            </select>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">{t('accountSettings')}</h2>
        <p className="settings-description">{t('accountSettingsDescription')}</p>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">{t('dataManagement')}</h2>
        <p className="settings-description">{t('dataManagementDescription')}</p>
      </section>
    </div>
  );
}


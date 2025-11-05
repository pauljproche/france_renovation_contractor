import { useLanguage } from '../contexts/AppContext.jsx';
import { translations } from '../i18n/translations.js';

export function useTranslation() {
  const { language } = useLanguage();
  const t = (key, params = {}) => {
    let translation = translations[language]?.[key] || key;
    // Replace placeholders with params
    Object.keys(params).forEach(paramKey => {
      translation = translation.replace(`{${paramKey}}`, params[paramKey]);
    });
    return translation;
  };
  return { t, language };
}


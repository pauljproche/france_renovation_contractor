import { useLanguage } from '../contexts/AppContext.jsx';
import { translations } from '../i18n/translations.js';

export function useTranslation() {
  const { language } = useLanguage();
  const t = (key) => {
    return translations[language]?.[key] || key;
  };
  return { t, language };
}


import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { t as translate, getLanguage, setLanguage as setLang, subscribe } from './index';

/**
 * I18n Context for React components
 * Provides translation function and language management via Context API
 */
const I18nContext = createContext(null);

/**
 * I18n Provider component
 * Wraps the application to provide i18n context to all child components
 */
export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(getLanguage);

  useEffect(() => {
    // Subscribe to language changes from other components or direct API calls
    const unsubscribe = subscribe((newLang) => {
      setLanguageState(newLang);
    });

    return unsubscribe;
  }, []);

  /**
   * Set the application language
   * @param {string} lang - Language code ('en' or 'zh-TW')
   */
  const setLanguage = useCallback((lang) => {
    setLang(lang);
    // State updates are handled by the subscribe callback
  }, []);

  /**
   * Translate a key with optional interpolation
   * @param {string} key - Translation key
   * @param {Object} params - Optional interpolation parameters
   * @returns {string} Translated string
   */
  const t = useCallback((key, params) => {
    return translate(key, params);
  }, [language]); // Re-create when language changes to ensure re-renders

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    t,
    language,
    setLanguage
  }), [t, language, setLanguage]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * React hook for internationalization
 * Must be used within an I18nProvider
 *
 * @returns {Object} { t, language, setLanguage }
 */
export function useI18n() {
  const context = useContext(I18nContext);

  if (context === null) {
    throw new Error('useI18n must be used within an I18nProvider');
  }

  return context;
}

export default I18nContext;

/**
 * Simple i18n manager for Repic
 * Supports English (en) and Traditional Chinese (zh-TW)
 */

import en from './locales/en.json';
import zhTW from './locales/zh-TW.json';

const STORAGE_KEY = 'repic-language';
const DEFAULT_LANGUAGE = 'en';
const SUPPORTED_LANGUAGES = ['en', 'zh-TW'];

const translations = {
  'en': en,
  'zh-TW': zhTW
};

let currentLanguage = DEFAULT_LANGUAGE;
let listeners = [];

/**
 * Detect browser language and return supported language code
 * @returns {string} Language code ('en' or 'zh-TW')
 */
function detectBrowserLanguage() {
  const browserLang = navigator.language || navigator.userLanguage || DEFAULT_LANGUAGE;

  // Check for exact match first
  if (SUPPORTED_LANGUAGES.includes(browserLang)) {
    return browserLang;
  }

  // Check for partial match (e.g., 'zh' matches 'zh-TW')
  const langPrefix = browserLang.split('-')[0];
  if (langPrefix === 'zh') {
    return 'zh-TW';
  }

  return DEFAULT_LANGUAGE;
}

/**
 * Initialize the i18n system
 * Loads saved language preference or auto-detects from browser
 */
function init() {
  const savedLanguage = localStorage.getItem(STORAGE_KEY);

  if (savedLanguage && SUPPORTED_LANGUAGES.includes(savedLanguage)) {
    currentLanguage = savedLanguage;
  } else {
    currentLanguage = detectBrowserLanguage();
    localStorage.setItem(STORAGE_KEY, currentLanguage);
  }
}

/**
 * Get the current language
 * @returns {string} Current language code
 */
function getLanguage() {
  return currentLanguage;
}

/**
 * Set the current language
 * @param {string} lang - Language code ('en' or 'zh-TW')
 */
function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    console.warn(`Unsupported language: ${lang}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
    return;
  }

  currentLanguage = lang;
  localStorage.setItem(STORAGE_KEY, lang);

  // Notify all listeners
  listeners.forEach(callback => callback(lang));
}

/**
 * Subscribe to language changes
 * @param {Function} callback - Function to call when language changes
 * @returns {Function} Unsubscribe function
 */
function subscribe(callback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(cb => cb !== callback);
  };
}

/**
 * Translate a key to the current language
 * Supports interpolation with {key} placeholders
 * @param {string} key - Translation key
 * @param {Object} params - Optional parameters for interpolation
 * @returns {string} Translated string or key if not found
 */
function t(key, params = {}) {
  const langTranslations = translations[currentLanguage] || translations[DEFAULT_LANGUAGE];
  let text = langTranslations[key];

  if (text === undefined) {
    console.warn(`Missing translation for key: ${key}`);
    return key;
  }

  // Handle interpolation
  if (params && Object.keys(params).length > 0) {
    Object.entries(params).forEach(([paramKey, value]) => {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), value);
    });
  }

  return text;
}

/**
 * Get list of supported languages
 * @returns {string[]} Array of supported language codes
 */
function getSupportedLanguages() {
  return [...SUPPORTED_LANGUAGES];
}

// Initialize on module load
init();

export {
  t,
  getLanguage,
  setLanguage,
  subscribe,
  getSupportedLanguages,
  SUPPORTED_LANGUAGES
};

export default {
  t,
  getLanguage,
  setLanguage,
  subscribe,
  getSupportedLanguages,
  SUPPORTED_LANGUAGES
};

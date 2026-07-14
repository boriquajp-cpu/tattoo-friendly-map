import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ja from '../locales/ja.json';
import zhTW from '../locales/zh-TW.json';
import en from '../locales/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ja: { translation: ja },
      'zh-TW': { translation: zhTW },
      en: { translation: en },
    },
    supportedLngs: ['ja', 'zh-TW', 'en'],
    nonExplicitSupportedLngs: true,
    fallbackLng: 'ja',
    interpolation: {
      escapeValue: false, // React handles XSS escaping automatically
    },
    detection: {
      order: ['localStorage', 'querystring', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  });

export default i18n;

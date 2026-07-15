import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ja from '../locales/ja.json';
import zhTW from '../locales/zh-TW.json';
import en from '../locales/en.json';

const STORAGE_KEY = 'i18nextLng';
const SUPPORTED = ['ja', 'zh-TW', 'en'] as const;
type Lang = (typeof SUPPORTED)[number];

const detectLanguage = (): Lang => {
  const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (saved && SUPPORTED.includes(saved)) return saved;

  const lang = navigator.language;
  if (lang.startsWith('zh')) return 'zh-TW';
  if (lang.startsWith('en')) return 'en';
  return 'ja';
};

void i18n.use(initReactI18next).init({
  resources: {
    ja: { translation: ja },
    'zh-TW': { translation: zhTW },
    en: { translation: en },
  },
  lng: detectLanguage(),
  fallbackLng: 'ja',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng: string) => {
  localStorage.setItem(STORAGE_KEY, lng);
});

export default i18n;

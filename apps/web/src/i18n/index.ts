import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import zh from './locales/zh.json'

export type SupportedLanguage = 'zh' | 'en'
const STORAGE_KEY = 'tcms.language'

function readStoredLanguage(): SupportedLanguage {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'en' ? 'en' : 'zh'
}

void i18n.use(initReactI18next).init({
  resources: { zh: { translation: zh }, en: { translation: en } },
  lng: readStoredLanguage(),
  fallbackLng: 'zh',
  interpolation: { escapeValue: false },
})

export function setLanguage(lang: SupportedLanguage) {
  localStorage.setItem(STORAGE_KEY, lang)
  void i18n.changeLanguage(lang)
}

export function getLanguage(): SupportedLanguage {
  return readStoredLanguage()
}

export default i18n

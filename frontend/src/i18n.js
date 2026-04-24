import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import I18nextHttpBackend from 'i18next-http-backend'

// Eagerly import en-GB so the app works without a network request
import enGB from './locales/en-GB/translation.json'

// RTL languages
const RTL_LANGS = ['ar', 'he']

export const LANGUAGES = [
  { code: 'en-GB', label: 'English (UK)', flag: '🇬🇧' },
  { code: 'en-US', label: 'English (US)', flag: '🇺🇸' },
  { code: 'fr',    label: 'Français',     flag: '🇫🇷' },
  { code: 'es',    label: 'Español',      flag: '🇪🇸' },
  { code: 'de',    label: 'Deutsch',      flag: '🇩🇪' },
  { code: 'nl',    label: 'Nederlands',   flag: '🇳🇱' },
  { code: 'it',    label: 'Italiano',     flag: '🇮🇹' },
  { code: 'he',    label: 'עברית',        flag: '🇮🇱' },
  { code: 'ar',    label: 'العربية',      flag: '🇸🇦' },
  { code: 'zu',    label: 'isiZulu',      flag: '🇿🇦' },
  { code: 'af',    label: 'Afrikaans',    flag: '🇿🇦' },
]

function applyDir(lang) {
  document.documentElement.dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr'
}

i18n
  .use(I18nextHttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { 'en-GB': { translation: enGB } },
    fallbackLng: 'en-GB',
    lng: localStorage.getItem('propairty_lang') || 'en-GB',
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage'], lookupLocalStorage: 'propairty_lang' },
    backend: { loadPath: '/locales/{{lng}}/translation.json' },
    partialBundledLanguages: true,
  })

i18n.on('languageChanged', (lang) => {
  localStorage.setItem('propairty_lang', lang)
  applyDir(lang)
})

applyDir(i18n.language)

export default i18n

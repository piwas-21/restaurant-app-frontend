// src/i18n.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Import translation files
import translationEN from "./locales/en/translation.json";
import translationDE from "./locales/de/translation.json";
import translationTR from "./locales/tr/translation.json";

const resources = {
  en: {
    translation: translationEN,
  },
  de: {
    translation: translationDE,
  },
  tr: {
    translation: translationTR,
  },
};

i18n
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Passes i18n down to react-i18next
  .init({
    resources,
    fallbackLng: "en", // Use English if detected language is not available
    debug: process.env.NODE_ENV === "development", // Enable debug mode in development
    interpolation: {
      escapeValue: false, // React already safes from xss
    },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
    },
  });

export default i18n;


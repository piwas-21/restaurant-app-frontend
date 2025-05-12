// src/components/LanguageSwitcher.tsx
"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import styles from "../app/styles/LanguageSwitcher.module.css"; // We will create this CSS module

const languages = [
  { code: "en", name: "English" },
  { code: "de", name: "Deutsch" },
  { code: "tr", name: "Türkçe" },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className={styles.languageSwitcherContainer} aria-label="Language selection">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => changeLanguage(lang.code)}
          disabled={i18n.resolvedLanguage === lang.code}
          className={`${styles.langButton} ${i18n.resolvedLanguage === lang.code ? styles.activeLang : ""}`}
          aria-pressed={i18n.resolvedLanguage === lang.code}
        >
          {lang.name}
        </button>
      ))}
    </div>
  );
}


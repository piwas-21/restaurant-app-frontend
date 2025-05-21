// src/components/LanguageSwitcher.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import Image from 'next/image';
import styles from "../app/styles/LanguageSwitcher.module.css";

const languages = [
  { code: "fr", name: "Français", flag: "/flags/fr.svg" },
  { code: "en", name: "English", flag: "/flags/en.svg" },
  { code: "it", name: "Italiano", flag: "/flags/it.svg" },
  { code: "de", name: "Deutsch", flag: "/flags/de.svg" },
  { code: "ar", name: "العربية", flag: "/flags/ar.svg" },
  { code: "tr", name: "Türkçe", flag: "/flags/tr.svg" },
] as const;

// Export the type for language codes
export type LanguageCode = typeof languages[number]['code'];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const changeLanguage = (lng: LanguageCode) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("i18nextLng", lng);
    setDropdownOpen(false);
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    // Bind the event listener
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  const currentLanguageDetails = languages.find(l => l.code === i18n.resolvedLanguage) || languages[0];

  return (
    <div className={styles.languageSwitcher} ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className={styles.dropdownToggle}
        aria-haspopup="listbox"
        aria-expanded={dropdownOpen}
      >
        <Image src={currentLanguageDetails.flag} alt={currentLanguageDetails.name} width={24} height={18} />
        <span className={styles.languageName}>{currentLanguageDetails.code.toUpperCase()}</span>
        <span className={styles.arrow}>{dropdownOpen ? "▲" : "▼"}</span>
      </button>
      {dropdownOpen && (
        <ul className={styles.dropdownMenu}>
          {languages.map((language) => (
            <li key={language.code}>
              <button
                onClick={() => changeLanguage(language.code)}
                className={styles.dropdownItem}
                role="option"
                aria-selected={language.code === i18n.resolvedLanguage}
              >
                <Image src={language.flag} alt={language.name} width={20} height={15} />
                <span>{language.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

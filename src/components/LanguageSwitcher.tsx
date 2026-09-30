// src/components/LanguageSwitcher.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import styles from '../app/styles/LanguageSwitcher.module.css';
import { SUPPORTED_LANGUAGES, LanguageCode } from '@/config/languageConfig';
import { useAuth } from '@/components/AuthContext';
import { saveLanguagePreference } from '@/services/userService';
import baseI18n from '../i18n';
import { publicLocaleHref, publicRouteLocation } from '@/lib/publicRouteQuery';

const languages = SUPPORTED_LANGUAGES;

export type { LanguageCode };

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const changeLanguage = (lng: LanguageCode) => {
    i18n.changeLanguage(lng);
    // Public routes use an isolated i18next clone so a URL locale cannot mutate the private app's
    // shared instance. An explicit choice is different: carry it to that shared instance too, so
    // navigating from a locale-prefixed page into an unprefixed account/cart route keeps the choice.
    if (i18n !== baseI18n) baseI18n.changeLanguage(lng);
    // Language preference is essential functionality, always save it
    // This is typically not considered a tracking/preference cookie
    localStorage.setItem('i18nextLng', lng);
    setDropdownOpen(false);

    // And, for someone signed in, on the ACCOUNT — which is what makes their mail follow the
    // choice (GAP-2 §1 rank 2). Deliberately fire-and-forget: the UI has already switched, and
    // awaiting it would make a menu click wait on the network. Safe to `void` because
    // `saveLanguagePreference` never rejects — it reports failure by resolving `false` — and never
    // signs anyone out, which a background write triggering apiClient's session-end would. A guest
    // needs nothing here: the `Accept-Language` header apiClient now sends carries their choice
    // onto the row they create.
    if (user) {
      void saveLanguagePreference(lng);
    }
  };

  const publicRoute = publicRouteLocation(pathname);

  const publicHref = (lng: LanguageCode): string | null => {
    if (!publicRoute) return null;
    return publicLocaleHref(lng, publicRoute.surface, searchParams);
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownRef]);

  // Fallback to English if current language details are not found (should not happen with proper setup)
  const currentLanguageDetails =
    languages.find((l) => l.code === i18n.resolvedLanguage) || languages.find((l) => l.code === 'en') || languages[0];

  const listRef = useRef<HTMLUListElement>(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

  useEffect(() => {
    if (dropdownOpen && listRef.current) {
      // Check if scrollable
      const { scrollHeight, clientHeight } = listRef.current;
      setShowScrollIndicator(scrollHeight > clientHeight);
    }
  }, [dropdownOpen]);

  const handleScroll = () => {
    if (listRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = listRef.current;
      // Hide indicator if near bottom
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 5;
      setShowScrollIndicator(!isNearBottom);
    }
  };

  const languageItems = languages.map((language) => {
    const href = publicHref(language.code);
    const contents = (
      <>
        <Image src={language.flag} alt={language.name} width={20} height={15} />
        <span>{language.name}</span>
      </>
    );
    return (
      <li key={language.code}>
        {href ? (
          <Link
            href={href}
            onClick={() => changeLanguage(language.code)}
            className={styles.dropdownItem}
            hrefLang={language.code}
          >
            {contents}
          </Link>
        ) : (
          <button onClick={() => changeLanguage(language.code)} className={styles.dropdownItem}>
            {contents}
          </button>
        )}
      </li>
    );
  });

  const scrollDown = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown from closing
    if (listRef.current) {
      listRef.current.scrollBy({ top: 100, behavior: 'smooth' });
    }
  };

  return (
    <div className={styles.languageSwitcher} ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className={styles.dropdownToggle}
        aria-expanded={dropdownOpen}
        aria-label="Toggle language menu"
      >
        <Image src={currentLanguageDetails.flag} alt={currentLanguageDetails.name} width={24} height={18} />
        <span className={styles.languageName}>{currentLanguageDetails.code.toUpperCase()}</span>
        <span className={styles.arrow}>{dropdownOpen ? '▲' : '▼'}</span>
      </button>
      <div
        className={`${styles.dropdownContainer} ${dropdownOpen ? '' : styles.dropdownContainerHidden}`}
        aria-hidden={!dropdownOpen}
      >
        {publicRoute ? (
          <nav aria-label={t('language', 'Language')}>
            <ul className={styles.dropdownMenu} ref={listRef} onScroll={handleScroll}>
              {languageItems}
            </ul>
          </nav>
        ) : (
          <ul className={styles.dropdownMenu} ref={listRef} onScroll={handleScroll}>
            {languageItems}
          </ul>
        )}
        {showScrollIndicator && (
          <div className={styles.scrollIndicator} onClick={scrollDown} role="button" aria-label="Scroll down">
            ▼
          </div>
        )}
      </div>
    </div>
  );
}

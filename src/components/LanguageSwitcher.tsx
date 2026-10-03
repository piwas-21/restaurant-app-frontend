// src/components/LanguageSwitcher.tsx
'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';
import Link from '@/components/TenantLink';
import { usePathname, useSearchParams } from 'next/navigation';
import styles from '../app/styles/LanguageSwitcher.module.css';
import { SUPPORTED_LANGUAGES, LanguageCode } from '@/config/languageConfig';
import { useAuth } from '@/components/AuthContext';
import { publicLocaleHref, publicRouteLocation } from '@/lib/publicRouteQuery';
import { tenantLocaleFromPathname } from '@/lib/tenantLocaleRouting';
import { localizedTenantHref } from '@/lib/tenantLocaleNavigation';
import { useLocaleSwitcher } from '@/hooks/useLocaleSwitcher';

const languages = SUPPORTED_LANGUAGES;

export type { LanguageCode };

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [locationHash, setLocationHash] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const closeAfterLocaleChange = useCallback(() => setDropdownOpen(false), []);
  const { changeLanguage, handleLocaleLinkClick, localeLoadFailed } = useLocaleSwitcher(
    i18n,
    Boolean(user),
    closeAfterLocaleChange,
  );

  const publicRoute = publicRouteLocation(pathname);
  const routeLocale = tenantLocaleFromPathname(pathname);
  const privateSearch = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
  const privateRoute = pathname ? `${pathname}${privateSearch}${locationHash}` : '';

  const hrefForLocale = (lng: LanguageCode): string | null => {
    if (publicRoute) return publicLocaleHref(lng, publicRoute.surface, searchParams);
    if (routeLocale) return localizedTenantHref(lng, privateRoute);
    return null;
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

  useEffect(() => {
    setLocationHash(window.location.hash);
  }, [pathname, searchParams]);

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
    const href = hrefForLocale(language.code);
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
            onClick={(event) => handleLocaleLinkClick(event, language.code, href)}
            className={styles.dropdownItem}
            hrefLang={language.code}
          >
            {contents}
          </Link>
        ) : (
          <button onClick={() => void changeLanguage(language.code)} className={styles.dropdownItem}>
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
        aria-label={t('language', 'Language')}
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
      {localeLoadFailed && (
        <p className={styles.loadFailure} role="alert">
          {t('languageLoadFailed')}
        </p>
      )}
    </div>
  );
}

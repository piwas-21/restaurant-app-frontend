'use client';

// craft sticky header (ADR-006, S15 T3 slice 2): the tenant's uploaded logo
// when it has one, else a hand-lettered wordmark (Amatic SC, from the
// RestaurantInfo API with the baked build-time name as fallback — same
// identity sources as the classic chrome). Logo OR wordmark, never both:
// a mark and its name stacked is two claims to the same identity. The SHARED
// role-based <RoleNavLinks/> re-skinned via tokens, and a mobile slide-in
// menu with the same keyboard/aria mechanics as the classic one
// (aria-expanded + translated open/close labels + aria-hidden backdrop).
// NOTE: no reservation CTA here — Reservations is already a RoleNavLinks
// nav link and the home hero owns the "Book a Table" CTA, so a header
// button would be a redundant third copy (craft-stitch-prompts.md Prompt 3).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Menu, X } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import UserMenu from '@/components/UserMenu';
import RoleNavLinks from '@/components/RoleNavLinks';
import { useAuth } from '@/components/AuthContext';
import { useRestaurantInfo } from '@/hooks/useRestaurantInfo';
import { useTheme } from '@/components/ThemeContext';
import TenantLogo from '@/components/branding/TenantLogo';
import { RESTAURANT_NAME } from '@/lib/config';
import styles from './CraftHeader.module.css';
import brand from './CraftBrand.module.css';

export default function CraftHeader() {
  const [isClient, setIsClient] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { info: restaurantInfo } = useRestaurantInfo();
  const { theme } = useTheme();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMobileMenu = () => setMobileMenuOpen(false);
  // Pre-hydration fallback mirrors classic: a static label until t() is safe.
  const menuToggleTranslated = mobileMenuOpen ? t('close_menu') : t('open_menu');
  const menuToggleLabel = isClient ? menuToggleTranslated : 'Open menu';

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" className={brand.wordmarkLink} onClick={closeMobileMenu}>
          <TenantLogo
            info={restaurantInfo}
            fallbackName={RESTAURANT_NAME}
            isDark={theme === 'dark'}
            width={180}
            height={64}
            imageClassName={brand.logo}
            lockupClassName={brand.wordmarkLockup}
            markClassName={brand.craftMark}
            textClassName={brand.wordmark}
            priority
          />
        </Link>
        <button
          className={styles.hamburger}
          onClick={toggleMobileMenu}
          aria-label={menuToggleLabel}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
        <div
          className={`${styles.backdrop} ${mobileMenuOpen ? styles.backdropVisible : ''}`}
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
        <nav className={`${styles.nav} ${mobileMenuOpen ? styles.navOpen : ''}`}>
          <RoleNavLinks onNavigate={closeMobileMenu} />
          {isClient && !isLoading && (
            <>
              {user ? (
                <UserMenu onMobileMenuClose={closeMobileMenu} />
              ) : (
                <Link
                  href="/auth/login"
                  className={`nav-link ${pathname === '/auth/login' ? 'active' : ''}`}
                  onClick={closeMobileMenu}
                >
                  {t('nav_login', 'Login')}
                </Link>
              )}
              <div className={styles.switchers}>
                <LanguageSwitcher />
                <ThemeSwitcher />
              </div>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

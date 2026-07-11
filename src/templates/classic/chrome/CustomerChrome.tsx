'use client';

// classic customer chrome (ADR-006, S15 T3 slice 2).
//
// VERBATIM extraction of app-internal-layout.tsx's customer render path
// with `isAdminPage` constant-folded to `false` (customer routes never
// reach this component — Shell.tsx dispatches staff/admin routes to the
// shared chrome). Zero visual delta on every customer route is the hard
// gate (screenshot suite), so this is a MOVE, not a rewrite: the inline
// CSSProperties, the `home-overlay-header` class swap and the exact DOM
// (including the folded-away `className={''}`) are kept as-is. The
// role-based nav links moved to the shared <RoleNavLinks/> (same JSX).
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from '@/components/ThemeContext';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { usePathname } from 'next/navigation';
import navStyles from '@/app/styles/Header.module.css';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import CookieSettingsModal from '@/components/CookieSettingsModal';
import FooterCookieLink from '@/components/FooterCookieLink';
import UserMenu from '@/components/UserMenu';
import { useAuth } from '@/components/AuthContext';
import RoleNavLinks from '@/components/RoleNavLinks';
import { Menu, X } from 'lucide-react';
import { useRestaurantInfo } from '@/hooks/useRestaurantInfo';
import { BRANDING_LOGO, BRANDING_LOGO_DARK, RESTAURANT_NAME } from '@/lib/config';

export default function CustomerChrome({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);
  const { theme } = useTheme();
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const { t } = useTranslation();
  const { info: restaurantInfo } = useRestaurantInfo();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerHeight = '80px';

  useEffect(() => {
    setIsClient(true);
    // Language and other effects...
  }, []);

  const useDarkLogoOnHome = isHomePage && theme !== 'dark';
  const logoSrc = theme === 'dark' || useDarkLogoOnHome ? BRANDING_LOGO_DARK : BRANDING_LOGO;
  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  const headerStyles: CSSProperties = {
    padding: '0 1rem',
    color: 'var(--text-color)',
    zIndex: 1000,
    height: headerHeight,
    position: isHomePage ? 'absolute' : 'sticky',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: isHomePage ? 'transparent' : 'var(--secondary-color)',
    borderBottom: isHomePage ? 'none' : '1px solid var(--border-color)',
    width: '100%',
  };

  const mainStyles: CSSProperties = {
    padding: isHomePage ? '0' : '1rem',
    flexGrow: 1,
  };

  const footerStyles: CSSProperties = {
    padding: '2rem 1rem',
    backgroundColor: 'var(--secondary-color)',
    color: 'var(--text-color)',
    textAlign: 'center',
    borderTop: '1px solid var(--border-color)',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* className: the original computed `isAdminPage ? … : ''` — the fold
          keeps the empty string so the rendered class attribute is identical. */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }} className={''}>
        {
          <header style={headerStyles} className={isHomePage && theme !== 'dark' ? 'home-overlay-header' : undefined}>
            <div
              style={{
                maxWidth: '1200px',
                margin: '0 auto',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                height: '100%',
              }}
            >
              <Link
                href="/"
                style={{ textDecoration: 'none', color: 'var(--primary-color)', display: 'flex', alignItems: 'center' }}
                onClick={closeMobileMenu}
              >
                <Image
                  src={logoSrc}
                  alt={`${restaurantInfo?.name ?? RESTAURANT_NAME} Logo`}
                  width={180}
                  height={90}
                  style={{ marginRight: '10px', objectFit: 'contain', maxHeight: `calc(${headerHeight} - 10px)` }}
                  priority
                />
              </Link>
              <button
                className={navStyles.hamburgerMenu}
                onClick={toggleMobileMenu}
                aria-label={isClient ? (mobileMenuOpen ? t('close_menu') : t('open_menu')) : 'Open menu'}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
              </button>
              {/* Mobile menu backdrop */}
              <div
                className={`${navStyles.mobileMenuBackdrop} ${mobileMenuOpen ? navStyles.visible : ''}`}
                onClick={closeMobileMenu}
                aria-hidden="true"
              />
              <nav className={`${navStyles.navLinksContainer} ${mobileMenuOpen ? navStyles.mobileMenuOpen : ''}`}>
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
                    <div className={navStyles.switcherGroup}>
                      <LanguageSwitcher />
                      <ThemeSwitcher />
                    </div>
                  </>
                )}
              </nav>
            </div>
          </header>
        }
        <main style={mainStyles}>{children}</main>
        {!isHomePage && (
          <footer style={footerStyles}>
            <p>
              {/* Name from the RestaurantInfo API (issue #125); baked build-time
                  name while it loads / if it's unreachable. */}
              {isClient
                ? t('home_footer_copyright', {
                    year: new Date().getFullYear(),
                    name: restaurantInfo?.name ?? RESTAURANT_NAME,
                  })
                : `© ${new Date().getFullYear()} ${RESTAURANT_NAME}. All rights reserved.`}
            </p>
            {restaurantInfo && (
              <p>
                {restaurantInfo.addressLine1}, {restaurantInfo.postalCode} {restaurantInfo.city},{' '}
                {restaurantInfo.country}
              </p>
            )}
            <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <Link
                href="/privacy-policy"
                style={{ color: 'inherit', textDecoration: 'underline', fontSize: '0.9rem' }}
              >
                {isClient ? t('footer_privacy_policy', 'Privacy Policy') : 'Privacy Policy'}
              </Link>
              <Link
                href="/terms-of-usage"
                style={{ color: 'inherit', textDecoration: 'underline', fontSize: '0.9rem' }}
              >
                {isClient ? t('footer_terms_of_usage', 'Terms of Usage') : 'Terms of Usage'}
              </Link>
            </div>
            <FooterCookieLink />
          </footer>
        )}
      </div>
      <CookieConsentBanner />
      <CookieSettingsModal />
    </div>
  );
}

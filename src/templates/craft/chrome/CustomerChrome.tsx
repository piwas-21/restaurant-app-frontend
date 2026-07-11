'use client';

// craft customer chrome (ADR-006, S15 T3 slice 2) — the craft template's
// own customer-facing shell: sticky letterpress header + craft footer.
// Same functionality as the classic chrome (role nav, cart badge, auth,
// switchers, cookie-consent surfaces, footer hidden on the home page which
// composes its own), different skin/structure. Styled exclusively via
// craft tokens (../tokens.css) + module CSS — no raw hex, dark atmosphere
// flips with html[data-theme="dark"].
import { usePathname } from 'next/navigation';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import CookieSettingsModal from '@/components/CookieSettingsModal';
import CraftHeader from './CraftHeader';
import CraftFooter from './CraftFooter';
import styles from './chrome.module.css';

export default function CustomerChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  return (
    <div className={styles.shell}>
      <CraftHeader />
      <main className={isHomePage ? styles.mainHome : styles.main}>{children}</main>
      {!isHomePage && <CraftFooter />}
      <CookieConsentBanner />
      <CookieSettingsModal />
    </div>
  );
}

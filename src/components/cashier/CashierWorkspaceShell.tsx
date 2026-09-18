'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { CircleAlert, CircleCheck, CircleDot, LoaderCircle } from 'lucide-react';
import { useTheme } from '@/components/ThemeContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import UserMenu from '@/components/UserMenu';
import TenantLogo from '@/components/branding/TenantLogo';
import { useRestaurantInfo } from '@/hooks/useRestaurantInfo';
import { useCashierOperationalCount } from '@/hooks/cashier/useCashierOperationalCount';
import { RESTAURANT_NAME } from '@/lib/config';
import {
  CASHIER_ORDERS_PATH,
  CASHIER_WORKSPACE_ROUTES,
  type CashierWorkspaceDestination,
} from '@/lib/cashierWorkspace';
import type { CashierQueueState } from '@/types/cashier';
import styles from './CashierWorkspaceShell.module.css';

interface CashierWorkspaceShellProps {
  readonly activeDestination: CashierWorkspaceDestination;
  readonly children: ReactNode;
  readonly queueState: CashierQueueState;
  readonly isConnected?: boolean;
  /** Locks workspace navigation while a tender outcome is still unresolved. */
  readonly navigationDisabled?: boolean;
}

type HealthTone = 'loading' | 'success' | 'warning' | 'danger';

const HEALTH_CLASSES: Record<HealthTone, string> = {
  loading: styles.healthWarning,
  success: styles.healthSuccess,
  warning: styles.healthWarning,
  danger: styles.healthDanger,
};

const HEALTH_ICONS = { loading: LoaderCircle, success: CircleCheck, warning: CircleDot, danger: CircleAlert };

function healthPresentation(queueState: CashierQueueState, isConnected: boolean | undefined) {
  if (queueState === 'loading') return { labelKey: 'cashier.workspace.health_connecting', tone: 'loading' as const };
  if (queueState === 'ready' && isConnected !== false) {
    return { labelKey: 'cashier.workspace.health_current', tone: 'success' as const };
  }
  if (queueState === 'stale') return { labelKey: 'cashier.workspace.health_stale', tone: 'warning' as const };
  return { labelKey: 'cashier.workspace.health_unavailable', tone: 'danger' as const };
}

function QueueHealth({ queueState, isConnected }: Pick<CashierWorkspaceShellProps, 'queueState' | 'isConnected'>) {
  const { t } = useTranslation();
  const presentation = healthPresentation(queueState, isConnected);
  const Icon = HEALTH_ICONS[presentation.tone];

  return (
    <output className={`${styles.health} ${HEALTH_CLASSES[presentation.tone]}`}>
      <Icon aria-hidden="true" size={16} />
      <span>{t(presentation.labelKey)}</span>
    </output>
  );
}

export default function CashierWorkspaceShell({
  activeDestination,
  children,
  queueState,
  isConnected,
  navigationDisabled = false,
}: CashierWorkspaceShellProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { theme } = useTheme();
  const { info } = useRestaurantInfo();
  const operationalCount = useCashierOperationalCount();
  const showOpenCount = operationalCount.count !== undefined;

  return (
    <div className={styles.workspace}>
      <header
        className={styles.header}
        aria-busy={navigationDisabled}
        onClickCapture={(event) => {
          if (!navigationDisabled) return;
          const target = event.target;
          if (target instanceof HTMLElement && target.closest('a,button')) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <Link href={CASHIER_ORDERS_PATH} className={styles.brand} aria-label={RESTAURANT_NAME}>
          <TenantLogo
            info={info}
            fallbackName={RESTAURANT_NAME}
            isDark={theme === 'dark'}
            width={120}
            height={48}
            imageClassName={styles.brandImage}
            lockupClassName={styles.brandLockup}
            markClassName={styles.brandMark}
            textClassName={styles.brandName}
          />
        </Link>
        <nav className={styles.navigation} aria-label={t('cashier.workspace.navigation')}>
          {CASHIER_WORKSPACE_ROUTES.map((route) => {
            const active = activeDestination === route.destination || pathname === route.href;
            return (
              <Link
                key={route.destination}
                href={route.href}
                className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`}
                aria-current={active ? 'page' : undefined}
                aria-disabled={navigationDisabled ? 'true' : undefined}
                onClick={(event) => {
                  if (navigationDisabled) event.preventDefault();
                }}
              >
                <span>{t(route.labelKey)}</span>
                {route.destination === 'orders' && showOpenCount && operationalCount.count > 0 && (
                  <span
                    className={styles.attentionBadge}
                    aria-label={t('cashier.workspace.open_count', { count: operationalCount.count })}
                    aria-live="polite"
                    role="status"
                  >
                    {operationalCount.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className={styles.actions}>
          <QueueHealth queueState={queueState} isConnected={isConnected} />
          {navigationDisabled && <output className="sr-only">{t('cashier.collection.payment_in_progress')}</output>}
          {operationalCount.state !== 'ready' && (
            <output className="sr-only">{t(operationalCount.statusMessageKey)}</output>
          )}
          <div className={styles.preferences}>
            <LanguageSwitcher />
            <ThemeSwitcher />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className={styles.content}>{children}</main>
    </div>
  );
}

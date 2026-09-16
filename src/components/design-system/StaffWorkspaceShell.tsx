'use client';

import { useId, type MouseEvent, type ReactNode } from 'react';
import { LogOut, MapPin, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ConnectionStateInput } from '@/lib/operationalStatus';
import ConnectionStateBanner from './ConnectionStateBanner';
import styles from './StaffWorkspaceLayout.module.css';

export interface StaffWorkspaceNavItem {
  href: string;
  label: string;
  icon?: ReactNode;
  active?: boolean;
  badge?: ReactNode;
}

export interface StaffWorkspaceShellProps {
  children: ReactNode;
  navItems?: readonly StaffWorkspaceNavItem[];
  tenantName?: string;
  locationName?: string;
  userName?: string;
  userRole?: string;
  connectionState?: ConnectionStateInput;
  lastConfirmed?: Date | string | null;
  onRetryConnection?: () => void;
  onLogout?: () => void;
  onNavigate?: (href: string) => void;
  headerActions?: ReactNode;
  className?: string;
}

function displayName(userName: string | undefined, userRole: string | undefined): string {
  return [userName, userRole].filter(Boolean).join(' · ');
}

function isPrimaryNavigationClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * Shared route chrome for Server and Cashier workspaces. Hosts provide route items, identity,
 * connectivity truth and route-specific actions; this shell does not own Cashier's SSE, payment,
 * or reconciliation behavior, so both surfaces consume the same chrome without duplicating it.
 */
export default function StaffWorkspaceShell({
  children,
  navItems = [],
  tenantName,
  locationName,
  userName,
  userRole,
  connectionState,
  lastConfirmed,
  onRetryConnection,
  onLogout,
  onNavigate,
  headerActions,
  className,
}: Readonly<StaffWorkspaceShellProps>) {
  const { t } = useTranslation();
  const hasIdentity = Boolean(tenantName || locationName || userName || userRole);
  const identityHeadingId = useId();

  return (
    <div className={[styles.shell, className].filter(Boolean).join(' ')}>
      <header className={styles.shellHeader}>
        {hasIdentity && (
          <section className={styles.identity} aria-labelledby={identityHeadingId}>
            <UserRound size={20} aria-hidden="true" />
            <div className={styles.identityText}>
              <h2 id={identityHeadingId} className="sr-only">
                {t('server.staff_identity', 'Staff identity')}
              </h2>
              {tenantName && (
                <strong className={styles.tenant} dir="auto">
                  {tenantName}
                </strong>
              )}
              {locationName && (
                <span className={styles.location} dir="auto">
                  <MapPin size={14} aria-hidden="true" /> {locationName}
                </span>
              )}
              {(userName || userRole) && <span className={styles.user}>{displayName(userName, userRole)}</span>}
            </div>
          </section>
        )}

        {navItems.length > 0 && (
          <nav className={styles.nav} aria-label={t('staff.workspace_navigation', 'Staff workspace navigation')}>
            {navItems.map((item) => (
              <a
                className={styles.navLink}
                data-active={item.active || undefined}
                href={item.href}
                key={item.href}
                aria-current={item.active ? 'page' : undefined}
                onClick={
                  onNavigate
                    ? (event) => {
                        if (!isPrimaryNavigationClick(event) || event.defaultPrevented) return;
                        event.preventDefault();
                        onNavigate(item.href);
                      }
                    : undefined
                }
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge}
              </a>
            ))}
          </nav>
        )}

        <div className={styles.shellActions}>
          {connectionState && (
            <ConnectionStateBanner
              state={connectionState}
              lastConfirmed={lastConfirmed}
              onRetry={onRetryConnection}
              compact
            />
          )}
          {headerActions}
          {onLogout && (
            <button
              type="button"
              className={styles.iconButton}
              onClick={onLogout}
              aria-label={t('user_menu.logout', 'Logout')}
              title={t('user_menu.logout', 'Logout')}
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

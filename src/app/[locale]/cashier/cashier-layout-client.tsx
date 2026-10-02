'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useTenantLocaleRouter as useRouter } from '@/hooks/useTenantLocaleRouter';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/components/AuthContext';
import { Loader2 } from 'lucide-react';
import { TenantFeaturesProvider, type TenantFeaturesState } from '@/contexts/TenantFeaturesContext';
import styles from './layout.module.css';
import { tenantLocaleHref } from '@/lib/tenantLocaleNavigation';

interface CashierLayoutClientProps {
  children: React.ReactNode;
  features: TenantFeaturesState;
}

export default function CashierLayoutClient({ children, features }: CashierLayoutClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();

  React.useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push(tenantLocaleHref(pathname, '/auth/login'));
      return;
    }

    const userRole = user.role?.toLowerCase();
    if (userRole !== 'cashier' && userRole !== 'admin') {
      router.push(tenantLocaleHref(pathname, '/'));
    }
  }, [isLoading, pathname, user, router]);

  if (isLoading) {
    return (
      <div className={styles.centerScreen}>
        <Loader2 size={48} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!user) return null;

  const userRole = user.role?.toLowerCase();
  if (userRole !== 'cashier' && userRole !== 'admin') {
    return (
      <div className={styles.centerScreen} role="alert">
        <p>{t('cashier.workspace.not_authorized')}</p>
      </div>
    );
  }

  return <TenantFeaturesProvider features={features}>{children}</TenantFeaturesProvider>;
}

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/components/AuthContext';
import { Loader2 } from 'lucide-react';
import styles from './layout.module.css';

interface CashierLayoutProps {
  children: React.ReactNode;
}

export default function CashierLayout({ children }: CashierLayoutProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();

  React.useEffect(() => {
    // Wait for auth to load
    if (isLoading) return;

    // Redirect to login if not authenticated. `/auth/login` — there is no `/login` route,
    // and pushing to one sent an unauthenticated cashier to a 404 instead of a sign-in form.
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // Redirect to home if not a cashier/admin
    const userRole = user.role?.toLowerCase();
    if (userRole !== 'cashier' && userRole !== 'admin') {
      router.push('/');
      return;
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className={styles.centerScreen}>
        <Loader2 size={48} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const userRole = user.role?.toLowerCase();
  if (userRole !== 'cashier' && userRole !== 'admin') {
    // Signed in without the cashier role: say so instead of a blank page while the
    // redirect home runs (somebody logged in on the counter tablet sees this panel).
    return (
      <div className={styles.centerScreen} role="alert">
        <p>{t('cashier.workspace.not_authorized')}</p>
      </div>
    );
  }

  return <>{children}</>;
}

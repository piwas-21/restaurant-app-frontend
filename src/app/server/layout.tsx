'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import styles from './layout.module.css';

export default function ServerLayout({ children }: { readonly children: ReactNode }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();
  const role = user?.role?.toLowerCase();
  const authorized = role === 'server' || role === 'admin';

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.push('/auth/login');
    else if (!authorized) router.push('/');
  }, [authorized, isLoading, router, user]);

  if (isLoading) {
    return (
      <div className={styles.centerScreen} aria-label={t('loading')}>
        <Loader2 className={styles.spinner} aria-hidden="true" size={48} />
      </div>
    );
  }
  if (!user) return null;
  if (!authorized) {
    return (
      <div className={styles.centerScreen} role="alert">
        <p>{t('server.takeaway.not_authorized')}</p>
      </div>
    );
  }
  return <>{children}</>;
}

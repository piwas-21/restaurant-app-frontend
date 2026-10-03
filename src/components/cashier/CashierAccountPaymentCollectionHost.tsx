'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import StaffButton from '@/components/design-system/StaffButton';
import { useOptionalAuth } from '@/components/AuthContext';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import { readPendingAccountPayment } from '@/lib/pendingAccountPayment';
import { loadAccountPaymentLocale } from '@/services/accountPaymentLocaleService';
import type { TableServiceSessionDto } from '@/types/order';
import { loadAccountPaymentCollection } from './accountPaymentCollectionLoader';
import styles from './CashierAccountPaymentCollectionHost.module.css';

type AccountPaymentCollectionComponent =
  typeof import('@/components/account-payments/AccountPaymentCollection').default;

interface Props {
  readonly session: TableServiceSessionDto;
  readonly disabled: boolean;
  readonly recoveryEnabled: boolean;
  readonly onUpdated: () => void;
  readonly fallback: ReactNode;
}

type HostState = 'checking' | 'dormant' | 'loading' | 'ready' | 'failed';

function actorIdFromAuth(auth: ReturnType<typeof useOptionalAuth>): string | undefined {
  const user = auth?.user;
  if (!user || !('userId' in user)) return undefined;
  return typeof user.userId === 'string' && user.userId.length > 0 ? user.userId : undefined;
}

export default function CashierAccountPaymentCollectionHost({
  session,
  disabled,
  recoveryEnabled,
  onUpdated,
  fallback,
}: Props) {
  const { t, i18n } = useTranslation();
  const auth = useOptionalAuth();
  const { tableAccountPaymentsV1: enabled } = useTenantFeatures();
  const actorId = actorIdFromAuth(auth);
  const [state, setState] = useState<HostState>('checking');
  const [Collection, setCollection] = useState<AccountPaymentCollectionComponent | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const generation = useRef(0);
  const i18nRef = useRef(i18n);
  i18nRef.current = i18n;
  const language = i18n.language;

  useEffect(() => {
    const currentGeneration = generation.current + 1;
    generation.current = currentGeneration;
    let cancelled = false;
    setCollection(null);

    if (auth?.isLoading) {
      setState('checking');
      return () => {
        cancelled = true;
      };
    }

    if (!actorId || !session.serviceSessionId) {
      setState('failed');
      return () => {
        cancelled = true;
      };
    }

    const saved = readPendingAccountPayment(actorId, session.serviceSessionId);
    if (!enabled && saved.status === 'none') {
      setState('dormant');
      return () => {
        cancelled = true;
      };
    }

    setState('loading');
    void Promise.all([loadAccountPaymentLocale(i18nRef.current, language), loadAccountPaymentCollection()])
      .then(([, module]) => {
        if (cancelled || generation.current !== currentGeneration) return;
        setCollection(() => module.default);
        setState('ready');
      })
      .catch(() => {
        if (cancelled || generation.current !== currentGeneration) return;
        setState('failed');
      });

    return () => {
      cancelled = true;
    };
  }, [actorId, auth?.isLoading, enabled, language, retryKey, session.serviceSessionId]);

  if (state === 'dormant') return fallback;
  if (state === 'checking' || state === 'loading') {
    return <output aria-live="polite">{t('cashier.tables.operation_checking')}</output>;
  }
  if (state === 'failed' || !Collection || !actorId) {
    return (
      <div className={styles.error} role="alert">
        <p>{t('cashier.tables.load_error')}</p>
        <StaffButton onClick={() => setRetryKey((current) => current + 1)}>{t('cashier.tables.retry')}</StaffButton>
      </div>
    );
  }

  return (
    <Collection
      key={`${actorId}:${session.serviceSessionId}`}
      actorId={actorId}
      session={session}
      enabled={enabled}
      disabled={disabled || !enabled}
      recoveryEnabled={recoveryEnabled}
      onUpdated={onUpdated}
    />
  );
}

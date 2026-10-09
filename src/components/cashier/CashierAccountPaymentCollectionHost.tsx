'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import StaffButton from '@/components/design-system/StaffButton';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import { useAccountPaymentActor } from '@/hooks/accountPayments/useAccountPaymentActor';
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
  readonly canStartCollection?: boolean;
  readonly showActorFailure?: boolean;
  readonly onUpdated: () => void;
  readonly onNavigationLockChange?: (locked: boolean) => void;
  readonly fallback: ReactNode;
}

type HostState = 'checking' | 'dormant' | 'loading' | 'ready' | 'failed';

export default function CashierAccountPaymentCollectionHost({
  session,
  disabled,
  recoveryEnabled,
  canStartCollection = true,
  showActorFailure = true,
  onUpdated,
  onNavigationLockChange,
  fallback,
}: Props) {
  const { t, i18n } = useTranslation();
  const actor = useAccountPaymentActor();
  const { tableAccountPaymentsV1 } = useTenantFeatures();
  const enabled = tableAccountPaymentsV1 && canStartCollection;
  const { actorId, status: actorStatus } = actor;
  const [state, setState] = useState<HostState>('checking');
  const [Collection, setCollection] = useState<AccountPaymentCollectionComponent | null>(null);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const generation = useRef(0);
  const i18nRef = useRef(i18n);
  i18nRef.current = i18n;
  const language = i18n.language;
  const viewKey =
    actorId && session.serviceSessionId ? `${actorId}:${session.serviceSessionId}:${enabled}:${language}` : null;

  useEffect(() => {
    const currentGeneration = generation.current + 1;
    generation.current = currentGeneration;
    let cancelled = false;
    setResolvedKey(null);
    setCollection(null);

    if (actorStatus === 'checking') {
      setState('checking');
      return () => {
        cancelled = true;
      };
    }

    if (actorStatus === 'failed' || !actorId || !session.serviceSessionId) {
      setState(actorStatus === 'failed' && !showActorFailure ? 'dormant' : 'failed');
      setResolvedKey(viewKey);
      return () => {
        cancelled = true;
      };
    }

    const saved = readPendingAccountPayment(actorId, session.serviceSessionId);
    if (!enabled && saved.status === 'none') {
      setState('dormant');
      setResolvedKey(viewKey);
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
        setResolvedKey(viewKey);
      })
      .catch(() => {
        if (cancelled || generation.current !== currentGeneration) return;
        setState('failed');
        setResolvedKey(viewKey);
      });

    return () => {
      cancelled = true;
    };
  }, [actorId, actorStatus, enabled, language, retryKey, session.serviceSessionId, showActorFailure, viewKey]);

  const retry = () => {
    actor.retry();
    setRetryKey((current) => current + 1);
  };

  if (actorStatus === 'failed' && !showActorFailure) return fallback;
  if (actorStatus === 'failed' || state === 'failed') {
    return (
      <div className={styles.error} role="alert">
        <p>{t('cashier.tables.load_error')}</p>
        <StaffButton onClick={retry}>{t('cashier.tables.retry')}</StaffButton>
      </div>
    );
  }
  if (actorStatus === 'checking' || resolvedKey !== viewKey || state === 'checking' || state === 'loading') {
    return <output aria-live="polite">{t('cashier.tables.operation_checking')}</output>;
  }
  if (state === 'dormant') return fallback;
  if (!Collection || !actorId) {
    return (
      <div className={styles.error} role="alert">
        <p>{t('cashier.tables.load_error')}</p>
        <StaffButton onClick={retry}>{t('cashier.tables.retry')}</StaffButton>
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
      onNavigationLockChange={onNavigationLockChange}
    />
  );
}

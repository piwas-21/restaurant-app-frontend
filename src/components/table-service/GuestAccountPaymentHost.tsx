'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { useTableGuestFeature } from '@/contexts/TableGuestFeatureContext';
import { useTableGuestVisit } from '@/contexts/TableGuestVisitContext';
import { hasGuestAccountPaymentRecovery } from '@/services/guestAccountPaymentStorage';
import { readStoredTableGuestState } from '@/services/tableGuestVisitStorage';
import { GUEST_PAYMENT_RECOVERY_CHANGED } from '@/lib/guestPaymentRecoverySignal';
import type { TableGuestAccountDto, TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import { stripGuestPaymentReturnFromUrl, type GuestPaymentReturnHint } from '@/lib/guestPaymentReturn';
import styles from './GuestAccountPaymentHost.module.css';

interface GuestAccountPaymentHostProps {
  readonly tableAccount: TableGuestAccountDto | null;
  readonly onAccountUpdated: () => void;
}

interface GuestAccountPaymentPanelProps {
  readonly tableAccount: TableGuestAccountDto | null;
  readonly activeIdentity: TableGuestVisitIdentity | null;
  readonly recoveryIdentity: TableGuestVisitIdentity | null;
  readonly newPaymentsEnabled: boolean;
  readonly canCreatePayment: boolean;
  readonly returnAttemptId: string | null;
  readonly returnHintPresent: boolean;
  readonly onAccountUpdated: () => void;
}

type PaymentPanelComponent = ComponentType<GuestAccountPaymentPanelProps>;

export default function GuestAccountPaymentHost({ tableAccount, onAccountUpdated }: GuestAccountPaymentHostProps) {
  const { t, i18n } = useTranslation();
  const features = useTableGuestFeature();
  const visit = useTableGuestVisit();
  const [returnHint, setReturnHint] = useState<GuestPaymentReturnHint | null>(null);
  const [panel, setPanel] = useState<PaymentPanelComponent | null>(null);
  const [bundleStatus, setBundleStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [retry, setRetry] = useState(0);
  const [hasRecovery, setHasRecovery] = useState(() => hasGuestAccountPaymentRecovery());
  const [storedVisit, setStoredVisit] = useState<ReturnType<typeof readStoredTableGuestState> | null>(null);
  const returnHintConsumed = useRef(false);
  const newPaymentsEnabled =
    features.tableGuestVisitsV1 &&
    features.tableAccountPaymentsV1 === true &&
    features.tableGuestAccountPaymentsV1 === true;
  const shouldLoad = newPaymentsEnabled || hasRecovery;
  const recoveryIdentity = storedVisit?.kind === 'visit' ? storedVisit.identity : null;
  const activeIdentity = visit.phase === 'active' ? visit.visit : null;
  const paymentIdentity = activeIdentity ?? recoveryIdentity;
  const panelIdentityKey = paymentIdentity
    ? `${paymentIdentity.serviceSessionId}:${paymentIdentity.participantToken}`
    : 'no-visit-identity';
  const canCreatePayment =
    newPaymentsEnabled &&
    activeIdentity !== null &&
    visit.phase === 'active' &&
    visit.pendingRound === null &&
    visit.pendingRoundStatus !== 'unknown';

  useLayoutEffect(() => {
    if (!returnHintConsumed.current) {
      returnHintConsumed.current = true;
      setReturnHint(stripGuestPaymentReturnFromUrl());
    }
    setStoredVisit(readStoredTableGuestState());
    setHasRecovery(hasGuestAccountPaymentRecovery());
  }, []);

  useEffect(() => {
    const refreshRecovery = () => setHasRecovery(hasGuestAccountPaymentRecovery());
    window.addEventListener(GUEST_PAYMENT_RECOVERY_CHANGED, refreshRecovery);
    return () => window.removeEventListener(GUEST_PAYMENT_RECOVERY_CHANGED, refreshRecovery);
  }, []);

  useLayoutEffect(() => {
    if (!shouldLoad) {
      setPanel(null);
      setBundleStatus('idle');
      return;
    }
    let current = true;
    setBundleStatus('loading');
    void import('@/services/tableGuestPaymentLocaleService')
      .then(({ loadTableGuestPaymentLocale }) =>
        loadTableGuestPaymentLocale(i18n, i18n.resolvedLanguage ?? i18n.language),
      )
      .then(() => import('./GuestAccountPaymentPanel'))
      .then((loaded) => {
        if (!current) return;
        setPanel(() => loaded.default);
        setBundleStatus('ready');
      })
      .catch(() => {
        if (current) setBundleStatus('unavailable');
      });
    return () => {
      current = false;
    };
  }, [i18n, i18n.language, retry, shouldLoad]);

  if (!shouldLoad) return null;
  if (bundleStatus === 'unavailable') {
    return (
      <section className={styles.notice} role="alert">
        <p>{t('table_guest_unavailable_detail')}</p>
        <button type="button" onClick={() => setRetry((value) => value + 1)}>
          {t('table_guest_refresh')}
        </button>
      </section>
    );
  }
  if (bundleStatus !== 'ready' || !panel) {
    return (
      <output className={styles.loading} aria-live="polite">
        {t('loading')}
      </output>
    );
  }

  const PaymentPanel = panel;
  return (
    <PaymentPanel
      key={panelIdentityKey}
      tableAccount={tableAccount}
      activeIdentity={activeIdentity}
      recoveryIdentity={recoveryIdentity}
      newPaymentsEnabled={newPaymentsEnabled}
      canCreatePayment={canCreatePayment}
      returnAttemptId={returnHint?.attemptId ?? null}
      returnHintPresent={returnHint?.present ?? false}
      onAccountUpdated={onAccountUpdated}
    />
  );
}

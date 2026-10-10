'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOptionalAuth } from '@/components/AuthContext';
import StaffButton from '@/components/design-system/StaffButton';
import { recoveryErrorTranslationKey } from '@/lib/tableOccupancyRecoveryLabels';
import { useAccountPaymentActor } from '@/hooks/accountPayments/useAccountPaymentActor';
import { useTableOccupancyRecovery } from '@/hooks/tableReadiness/useTableOccupancyRecovery';
import { loadAccountPaymentLocale } from '@/services/accountPaymentLocaleService';
import TableOccupancyRecoveryPreview from './TableOccupancyRecoveryPreview';
import styles from './TableReadinessAction.module.css';

interface Props {
  readonly tableId: string;
  readonly serviceSessionId?: string;
  readonly enabled: boolean;
  readonly disabled?: boolean;
  readonly onRecovered: () => Promise<void>;
  readonly onNavigationLockChange?: (locked: boolean) => void;
}

function useRecoveryText(visible: boolean) {
  const { i18n } = useTranslation();
  const [locale, setLocale] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const instance = useRef(i18n);
  instance.current = i18n;
  const language = i18n.language;
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setFailed(false);
    void loadAccountPaymentLocale(instance.current, language).then(
      () => {
        if (active) setLocale(language);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [language, retry, visible]);
  return { language, locale, failed, retry: () => setRetry((value) => value + 1) };
}

function money(value: number, currency: string | null, locale: string): string {
  if (!currency) return String(value);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  } catch (_error: unknown) {
    return `${value} ${currency}`;
  }
}

export default function TableOccupancyRecoveryAction({
  tableId,
  serviceSessionId,
  enabled,
  disabled = false,
  onRecovered,
  onNavigationLockChange,
}: Props) {
  const { t } = useTranslation();
  const auth = useOptionalAuth();
  const actor = useAccountPaymentActor();
  const role = auth?.user?.role;
  const authorized = role === 'Admin' || role === 'Cashier' || role === 'Server';
  const visible = authorized && actor.status !== 'checking';
  const text = useRecoveryText(visible);
  if (!authorized) return null;
  if (!enabled && actor.status === 'checking') return null;
  if (actor.status === 'checking') return <output aria-live="polite">{t('cashier.tables.operation_checking')}</output>;
  if (!actor.actorId) {
    return (
      <div role="alert">
        <p>{t('cashier.tables.load_error')}</p>
        <StaffButton onClick={actor.retry}>{t('cashier.tables.retry')}</StaffButton>
      </div>
    );
  }

  return (
    <RecoveryPanel
      key={[actor.actorId, role, tableId, serviceSessionId ?? 'unassigned'].join(':')}
      actorId={actor.actorId}
      actorRole={role}
      tableId={tableId}
      serviceSessionId={serviceSessionId}
      enabled={enabled}
      disabled={disabled}
      onRecovered={onRecovered}
      onNavigationLockChange={onNavigationLockChange}
      text={text}
    />
  );
}

function RecoveryPanel({
  actorId,
  actorRole,
  tableId,
  serviceSessionId,
  enabled,
  disabled,
  onRecovered,
  onNavigationLockChange,
  text,
}: {
  readonly actorId: string;
  readonly actorRole: 'Admin' | 'Cashier' | 'Server';
  readonly tableId: string;
  readonly serviceSessionId?: string;
  readonly enabled: boolean;
  readonly disabled: boolean;
  readonly onRecovered: () => Promise<void>;
  readonly onNavigationLockChange?: (locked: boolean) => void;
  readonly text: ReturnType<typeof useRecoveryText>;
}) {
  const { t } = useTranslation();
  const canWrite = enabled && !disabled;
  const recovery = useTableOccupancyRecovery({ actorId, actorRole, tableId, serviceSessionId, canWrite, onRecovered });
  useEffect(() => {
    onNavigationLockChange?.(recovery.hasPendingOperation);
    return () => onNavigationLockChange?.(false);
  }, [onNavigationLockChange, recovery.hasPendingOperation]);
  if (text.failed) {
    return (
      <div role="alert">
        <p>{t('cashier.tables.load_error')}</p>
        <StaffButton onClick={text.retry}>{t('cashier.tables.retry')}</StaffButton>
      </div>
    );
  }
  if (text.locale !== text.language || recovery.stage === 'checking') {
    return <output aria-live="polite">{t('cashier.tables.operation_checking')}</output>;
  }
  const preview = recovery.preview;
  const operationPending = recovery.stage === 'pending' || recovery.stage === 'working';
  const isPreviewOpen = recovery.stage === 'previewed' || (recovery.stage === 'failed' && preview !== undefined);
  const dateLocale = text.language || 'en';
  if (recovery.stage === 'idle' && !enabled) return null;
  return (
    <section className={styles.panel} aria-label={t('accountPayments.recovery.title')}>
      <h2>{t('accountPayments.recovery.title')}</h2>
      <p>{t('accountPayments.recovery.intro')}</p>
      {(!enabled || disabled) && recovery.stage !== 'idle' && <p>{t('accountPayments.recovery.disabled_recovery')}</p>}
      {recovery.stage === 'idle' && enabled && (
        <StaffButton variant="secondary" onClick={() => void recovery.startPreview()} disabled={!canWrite}>
          {t('accountPayments.recovery.review_action')}
        </StaffButton>
      )}
      {recovery.stage === 'previewing' && <output aria-live="polite">{t('accountPayments.recovery.loading')}</output>}
      {recovery.stage === 'failed' && !preview && (
        <div role="alert">
          <p>{t(recoveryErrorTranslationKey(recovery.error, 'preview_failed'))}</p>
          <StaffButton onClick={() => void recovery.startPreview()} disabled={!canWrite}>
            {recovery.error === 'stale_preview' || recovery.error === 'session_ambiguous'
              ? t('accountPayments.recovery.refresh_preview')
              : t('accountPayments.recovery.review_action')}
          </StaffButton>
        </div>
      )}
      {recovery.stage === 'unavailable' && (
        <div role="alert">
          <p>{t(recoveryErrorTranslationKey(recovery.error, 'storage_unavailable'))}</p>
          {recovery.operation && <p>{t('accountPayments.recovery.completed_storage_warning')}</p>}
          {recovery.error !== 'role_mismatch' && (
            <div className={styles.actions}>
              <StaffButton onClick={() => void recovery.check()}>{t('accountPayments.recovery.check')}</StaffButton>
              <StaffButton onClick={() => void recovery.retry()} disabled={!canWrite}>
                {t('accountPayments.recovery.retry_same')}
              </StaffButton>
            </div>
          )}
        </div>
      )}
      {operationPending && (
        <div role="status" aria-live="polite">
          <p>{t('accountPayments.recovery.unknown')}</p>
          <div className={styles.actions}>
            <StaffButton onClick={() => void recovery.check()} disabled={recovery.stage === 'working'}>
              {t('accountPayments.recovery.check')}
            </StaffButton>
            <StaffButton onClick={() => void recovery.retry()} disabled={!canWrite || recovery.stage === 'working'}>
              {t('accountPayments.recovery.retry_same')}
            </StaffButton>
          </div>
        </div>
      )}
      {recovery.stage === 'settled' && recovery.operation && (
        <div role="status" aria-live="polite">
          <p>
            {t('accountPayments.recovery.succeeded', {
              cancelled: recovery.operation.cancelledUnsentCount,
              archived: recovery.operation.archivedLegacyCount,
              retained: recovery.operation.retainedPriorVisitCount,
            })}
          </p>
          <p>
            {t('accountPayments.recovery.preserved_totals', {
              paid: money(recovery.operation.preservedPaidAmount, recovery.currency ?? null, dateLocale),
              outstanding: money(recovery.operation.preservedOutstandingAmount, recovery.currency ?? null, dateLocale),
            })}
          </p>
        </div>
      )}
      {preview && (
        <TableOccupancyRecoveryPreview
          preview={preview}
          isOpen={isPreviewOpen}
          isWorking={recovery.stage === 'working'}
          canWrite={canWrite}
          reason={recovery.reason}
          error={recovery.error}
          locale={dateLocale}
          onReasonChange={recovery.setReason}
          onClose={recovery.closePreview}
          onConfirm={() => void recovery.confirm()}
          t={t}
        />
      )}
    </section>
  );
}

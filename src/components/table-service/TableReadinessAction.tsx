'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOptionalAuth } from '@/components/AuthContext';
import StaffButton from '@/components/design-system/StaffButton';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import { useAccountPaymentActor } from '@/hooks/accountPayments/useAccountPaymentActor';
import { useTableReadiness } from '@/hooks/tableReadiness/useTableReadiness';
import { loadAccountPaymentLocale } from '@/services/accountPaymentLocaleService';
import type { PendingTableReadiness, TableReadinessOutcome } from '@/types/tableReadiness';
import styles from './TableReadinessAction.module.css';

interface Props {
  readonly tableId: string;
  readonly readinessState?: string | null;
  readonly readinessVersion?: number | null;
  readonly canMarkReady: boolean;
  /** Kept for caller compatibility; readiness evidence comes from explicit projection fields. */
  readonly snapshot: object;
  readonly isStale: boolean;
  readonly refresh: () => Promise<void>;
  readonly onConfirmedReady?: (outcome: TableReadinessOutcome) => void;
}

type OwnedProps = Props & { readonly actorId: string; readonly actorRole: PendingTableReadiness['actorRole'] };

function resolveReadinessState(snapshot: object, readinessState: string | null | undefined) {
  if (readinessState !== undefined) return readinessState;
  if (!('readinessState' in snapshot)) return undefined;
  const value = (snapshot as { readonly readinessState?: unknown }).readinessState;
  return typeof value === 'string' || value === null ? value : undefined;
}

function refusalMessageKey(code: string): string {
  const keys: Record<string, string> = {
    TableReadinessVersionStale: 'accountPayments.readiness.errors.version_stale',
    TableReadinessVisitOpen: 'accountPayments.readiness.errors.visit_open',
    TableReadinessNotAvailable: 'accountPayments.readiness.errors.not_available',
    TableServiceTableInactive: 'accountPayments.readiness.errors.inactive',
    TableServiceSessionAmbiguous: 'accountPayments.readiness.errors.ambiguous',
  };
  return keys[code] ?? 'accountPayments.readiness.refused';
}

function OwnedAction({
  actorId,
  actorRole,
  tableId,
  readinessState,
  readinessVersion,
  canMarkReady,
  snapshot,
  isStale,
  refresh,
  onConfirmedReady,
}: OwnedProps) {
  const { t, i18n } = useTranslation();
  const { tableVisitReadinessV1: enabled } = useTenantFeatures();
  const hasReadinessVersion = Number.isSafeInteger(readinessVersion) && (readinessVersion ?? 0) > 0;
  const action = useTableReadiness({
    actorId,
    actorRole,
    tableId,
    readinessState: resolveReadinessState(snapshot, readinessState),
    readinessVersion,
    canStart: enabled === true && canMarkReady && !isStale && hasReadinessVersion,
    isStale,
    refresh,
    onConfirmedReady,
  });
  const [locale, setLocale] = useState<string | null>(null);
  const [localeFailed, setLocaleFailed] = useState(false);
  const [localeRetry, setLocaleRetry] = useState(0);
  const instance = useRef(i18n);
  instance.current = i18n;
  const language = i18n.language;
  const visible = (enabled === true && canMarkReady) || (action.stage !== 'idle' && action.stage !== 'checking');
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLocaleFailed(false);
    void loadAccountPaymentLocale(instance.current, language).then(
      () => {
        if (active) setLocale(language);
      },
      () => {
        if (active) setLocaleFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [language, localeRetry, visible]);
  if (!visible) return null;
  if (localeFailed)
    return (
      <div role="alert">
        <p>{t('cashier.tables.load_error')}</p>
        <StaffButton onClick={() => setLocaleRetry((version) => version + 1)}>{t('cashier.tables.retry')}</StaffButton>
      </div>
    );
  if (locale !== language || action.stage === 'checking') {
    return <output aria-live="polite">{t('cashier.tables.operation_checking')}</output>;
  }
  const working = action.stage === 'working';
  const pending = action.stage === 'pending' || working;
  let settledMessageKey = 'accountPayments.readiness.refused';
  if (action.result?.kind === 'succeeded') {
    settledMessageKey = 'accountPayments.readiness.succeeded';
  } else if (action.result?.kind === 'refused') {
    settledMessageKey = refusalMessageKey(action.result.code);
  }
  return (
    <section id="table-readiness-actions" className={styles.panel} aria-label={t('accountPayments.readiness.title')}>
      <h2>{t('accountPayments.readiness.title')}</h2>
      {action.stage === 'idle' && (
        <>
          <p>{t('accountPayments.readiness.confirm_reset')}</p>
          {enabled && canMarkReady && !hasReadinessVersion && (
            <p role="alert">{t('accountPayments.readiness.version_unavailable')}</p>
          )}
          <StaffButton
            variant="primary"
            onClick={() => void action.start()}
            disabled={!enabled || !canMarkReady || isStale || !hasReadinessVersion}
          >
            {t('server.floor.ready_action')}
          </StaffButton>
        </>
      )}
      {pending && (
        <>
          <output aria-live="polite">
            {t(working ? 'accountPayments.readiness.checking' : 'accountPayments.readiness.unknown')}
          </output>
          {!enabled && <p>{t('accountPayments.readiness.disabled_recovery')}</p>}
          <div className={styles.actions}>
            <StaffButton onClick={() => void action.check()} disabled={working}>
              {t('accountPayments.readiness.check')}
            </StaffButton>
            <StaffButton onClick={() => void action.retry()} disabled={working}>
              {t('accountPayments.readiness.retry')}
            </StaffButton>
          </div>
        </>
      )}
      {action.stage === 'unavailable' && <p role="alert">{t('accountPayments.readiness.storage_unavailable')}</p>}
      {action.stage === 'settled' && (
        <>
          <output aria-live="polite">{t(settledMessageKey)}</output>
          {action.result?.kind === 'refused' && action.result.code !== 'unknown' && <code>{action.result.code}</code>}
          <StaffButton onClick={() => void refresh().catch(() => undefined)}>
            {t('accountPayments.readiness.refresh')}
          </StaffButton>
          {action.result?.kind === 'refused' && (
            <StaffButton
              variant="primary"
              onClick={() => void action.start()}
              disabled={!action.canRetryRefusal || !canMarkReady || isStale || !hasReadinessVersion}
            >
              {t('server.floor.ready_action')}
            </StaffButton>
          )}
        </>
      )}
    </section>
  );
}

/** Mount recovery even if the table acquired a new visit or new readiness writes are disabled. */
export default function TableReadinessAction(props: Props) {
  const { t } = useTranslation();
  const { tableVisitReadinessV1: enabled } = useTenantFeatures();
  const auth = useOptionalAuth();
  const actor = useAccountPaymentActor();
  const role = auth?.user?.role;
  if (role !== 'Admin' && role !== 'Cashier' && role !== 'Server') return null;
  if (actor.status === 'checking') return enabled ? <output>{t('cashier.tables.operation_checking')}</output> : null;
  if (actor.status === 'failed' || !actor.actorId)
    return (
      <div role="alert">
        <p>{t('cashier.tables.load_error')}</p>
        <StaffButton onClick={actor.retry}>{t('cashier.tables.retry')}</StaffButton>
      </div>
    );
  return (
    <OwnedAction
      key={`${actor.actorId}:${role}:${props.tableId}`}
      {...props}
      actorId={actor.actorId}
      actorRole={role}
    />
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useOptionalAuth } from '@/components/AuthContext';
import StaffButton from '@/components/design-system/StaffButton';
import { useAccountPaymentActor } from '@/hooks/accountPayments/useAccountPaymentActor';
import { useOrderAmendmentTranslations } from '@/hooks/orderAmendments/useOrderAmendmentTranslations';
import { useAmendmentResolutionRecoveryInventory } from '@/hooks/orderAmendments/useAmendmentResolutionRecoveryInventory';
import { restoreAmendmentResolutionRecovery } from '@/lib/amendmentResolutionRecoveryBootstrap';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import { AmendmentResolutionUiContext } from '@/contexts/AmendmentResolutionUiContext';
import {
  readPendingAmendmentResolutionsForOrder,
  type PendingResolutionsForOrderRead,
} from '@/lib/pendingAmendmentResolution';
import AmendmentResolutionModal from './AmendmentResolutionModal';
import styles from './AmendmentResolution.module.css';

interface Props {
  readonly orderId: string;
  readonly onChanged: () => void;
  readonly children: ReactNode;
}
interface Selection {
  readonly amendmentId: string;
  readonly expected?: { readonly currency: string; readonly creditMinor: number };
}

export default function AmendmentResolutionProvider(props: Props) {
  const auth = useOptionalAuth();
  return auth?.user?.role === 'Admin' && !auth.isLoading ? (
    <AdminResolutionProvider {...props} />
  ) : (
    <>{props.children}</>
  );
}

function AdminResolutionProvider(props: Props) {
  const actor = useAccountPaymentActor();
  const { t } = useTranslation();
  return actor.actorId && actor.status === 'ready' ? (
    <ResolvedActorProvider key={`${actor.actorId}:${props.orderId}`} {...props} actorId={actor.actorId} />
  ) : (
    <>
      {props.children}
      <output aria-live="polite">{actor.status === 'checking' ? t('common.loading') : t('error_unexpected')}</output>
      {actor.status === 'failed' && <StaffButton onClick={actor.retry}>{t('retry')}</StaffButton>}
    </>
  );
}

function ResolvedActorProvider({ orderId, actorId, onChanged, children }: Props & { readonly actorId: string }) {
  const { t } = useTranslation();
  const { orderAmendmentsV1 } = useTenantFeatures();
  const [inventory, setInventory] = useState<PendingResolutionsForOrderRead | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const remote = useAmendmentResolutionRecoveryInventory(actorId, orderId);
  const refreshRemote = remote.refresh;
  const refreshInventory = useCallback(
    () => setInventory(readPendingAmendmentResolutionsForOrder(actorId, orderId)),
    [actorId, orderId],
  );
  useEffect(refreshInventory, [refreshInventory]);
  const translations = useOrderAmendmentTranslations(
    orderAmendmentsV1 || inventory?.status !== 'none' || remote.inventory.status !== 'none',
  );
  const changed = useCallback(() => {
    refreshInventory();
    void refreshRemote();
    onChanged();
  }, [onChanged, refreshInventory, refreshRemote]);
  const open = useCallback(
    (amendmentId: string, expected?: Selection['expected']) => setSelection({ amendmentId, expected }),
    [],
  );
  const close = () => {
    setSelection(null);
    refreshInventory();
    void refreshRemote();
  };
  const recover = (amendmentId: string) => {
    const accepted =
      remote.inventory.status === 'pending'
        ? remote.inventory.values.find((value) => value.pending.amendmentId === amendmentId)
        : undefined;
    if (accepted) {
      const restored = restoreAmendmentResolutionRecovery(accepted);
      if (restored.status !== 'pending') {
        setInventory({ status: 'unavailable' });
        return;
      }
      refreshInventory();
    }
    open(amendmentId);
  };
  const recoverable = new Set([
    ...(inventory?.status === 'pending' ? inventory.values.map((value) => value.amendmentId) : []),
    ...(remote.inventory.status === 'pending' ? remote.inventory.values.map((value) => value.pending.amendmentId) : []),
  ]);
  const contextValue = useMemo(
    () => ({
      open,
      canStart: orderAmendmentsV1 && inventory?.status === 'none' && remote.inventory.status === 'none',
    }),
    [open, orderAmendmentsV1, inventory?.status, remote.inventory.status],
  );
  return (
    <AmendmentResolutionUiContext.Provider value={contextValue}>
      {children}
      {translations.ready && inventory?.status === 'unavailable' && (
        <div role="alert" className={styles.error}>
          <p>{t('orderAmendments.resolution_storage_failed')}</p>
          <StaffButton onClick={refreshInventory}>{t('retry')}</StaffButton>
        </div>
      )}
      {translations.ready && remote.inventory.status === 'checking' && (
        <output aria-live="polite">{t('common.loading')}</output>
      )}
      {translations.ready && remote.inventory.status === 'unavailable' && (
        <div role="alert" className={styles.error}>
          <p>{t('error_unexpected')}</p>
          <StaffButton onClick={() => void refreshRemote()}>{t('retry')}</StaffButton>
        </div>
      )}
      {translations.ready && inventory?.status !== 'unavailable' && recoverable.size > 0 && (
        <section className={styles.recovery}>
          <p className={styles.notice}>{t('orderAmendments.resolution_pending')}</p>
          <div className={styles.actions}>
            {[...recoverable].map((amendmentId) => (
              <StaffButton key={amendmentId} onClick={() => recover(amendmentId)}>
                {t('orderAmendments.resolution_recover', { reference: amendmentId })}
              </StaffButton>
            ))}
          </div>
        </section>
      )}
      {!translations.ready && inventory?.status !== 'none' && (
        <div>
          <output aria-live="polite">{translations.failed ? t('error_unexpected') : t('common.loading')}</output>
          {translations.failed && <StaffButton onClick={translations.retry}>{t('retry')}</StaffButton>}
        </div>
      )}
      {selection && translations.ready && (
        <AmendmentResolutionModal
          key={`${actorId}:${orderId}:${selection.amendmentId}`}
          actorId={actorId}
          orderId={orderId}
          {...selection}
          enabled={orderAmendmentsV1}
          onChanged={changed}
          onClose={close}
        />
      )}
    </AmendmentResolutionUiContext.Provider>
  );
}

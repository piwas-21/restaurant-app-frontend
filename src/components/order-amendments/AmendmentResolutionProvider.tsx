'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useOptionalAuth } from '@/components/AuthContext';
import StaffButton from '@/components/design-system/StaffButton';
import { useAccountPaymentActor } from '@/hooks/accountPayments/useAccountPaymentActor';
import { useOrderAmendmentTranslations } from '@/hooks/orderAmendments/useOrderAmendmentTranslations';
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
  const refreshInventory = useCallback(
    () => setInventory(readPendingAmendmentResolutionsForOrder(actorId, orderId)),
    [actorId, orderId],
  );
  useEffect(refreshInventory, [refreshInventory]);
  const translations = useOrderAmendmentTranslations(orderAmendmentsV1 || inventory?.status !== 'none');
  const changed = useCallback(() => {
    refreshInventory();
    onChanged();
  }, [onChanged, refreshInventory]);
  const open = useCallback(
    (amendmentId: string, expected?: Selection['expected']) => setSelection({ amendmentId, expected }),
    [],
  );
  const close = () => {
    setSelection(null);
    refreshInventory();
  };
  return (
    <AmendmentResolutionUiContext.Provider
      value={{ open, canStart: orderAmendmentsV1 && inventory?.status === 'none' }}
    >
      {children}
      {translations.ready && inventory?.status === 'unavailable' && (
        <div role="alert" className={styles.error}>
          <p>{t('orderAmendments.resolution_storage_failed')}</p>
          <StaffButton onClick={refreshInventory}>{t('retry')}</StaffButton>
        </div>
      )}
      {translations.ready && inventory?.status === 'pending' && (
        <section className={styles.recovery}>
          <p className={styles.notice}>{t('orderAmendments.resolution_pending')}</p>
          <div className={styles.actions}>
            {inventory.values.map((value) => (
              <StaffButton key={value.amendmentId} onClick={() => open(value.amendmentId)}>
                {t('orderAmendments.resolution_recover', { reference: value.amendmentId })}
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

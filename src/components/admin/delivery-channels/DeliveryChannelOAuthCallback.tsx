'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Link from '@/components/TenantLink';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import StatusBadge from '@/components/design-system/StatusBadge';
import { useDeliveryChannelOAuthCallback } from '@/hooks/admin/useDeliveryChannelOAuthCallback';
import { formatDeliveryChannelDate } from '@/lib/deliveryChannelFormat';
import styles from './DeliveryChannelOAuthCallback.module.css';

function CallbackStatus() {
  const params = useSearchParams();
  const flowId = params.get('flowId');
  const { flow, state, errorMessage, retry } = useDeliveryChannelOAuthCallback(flowId);
  const { t, i18n } = useTranslation();
  const successful = state === 'connected';
  let tone: 'success' | 'info' | 'warning' | 'neutral' = 'neutral';
  if (successful) tone = 'success';
  else if (state === 'pending' || state === 'checking') tone = 'info';
  else if (['failed', 'expired', 'error', 'invalid', 'unconfirmed'].includes(state)) tone = 'warning';

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-live="polite">
        <p className={styles.eyebrow}>{t('deliveryChannels.callback.eyebrow')}</p>
        <h1>{t('deliveryChannels.callback.title')}</h1>
        <StatusBadge tone={tone}>{t(`deliveryChannels.callback.state.${state}`)}</StatusBadge>
        <p className={styles.message}>{errorMessage ?? t(`deliveryChannels.callback.message.${state}`)}</p>
        {flow?.errorCode && (
          <p className={styles.message}>
            {t(`deliveryChannels.codes.${flow.errorCode}`, { defaultValue: t('deliveryChannels.codes.generic') })}
          </p>
        )}
        {flow?.storeId && (
          <p className={styles.storeId}>
            {t('deliveryChannels.store.idLabel')}: <code dir="ltr">{flow.storeId}</code>
          </p>
        )}
        {flow?.expiresAt && (
          <p className={styles.updated}>
            {t('deliveryChannels.connection.linkExpires', {
              time: formatDeliveryChannelDate(
                flow.expiresAt,
                i18n.resolvedLanguage || i18n.language,
                t('deliveryChannels.timeUnavailable'),
              ),
            })}
          </p>
        )}
        {state === 'error' && (
          <button className={styles.secondaryAction} type="button" onClick={retry}>
            {t('deliveryChannels.callback.retry')}
          </button>
        )}
        <Link className={styles.action} href="/admin/delivery-channels">
          {t('deliveryChannels.callback.backToManagement')}
        </Link>
      </section>
    </main>
  );
}

function CallbackLoading() {
  const { t } = useTranslation();
  return <output className={styles.loading}>{t('deliveryChannels.loading')}</output>;
}

export default function DeliveryChannelOAuthCallback() {
  return (
    <AdminAuthGuard requiredRoles={['Admin']}>
      <Suspense fallback={<CallbackLoading />}>
        <CallbackStatus />
      </Suspense>
    </AdminAuthGuard>
  );
}

'use client';

import { useTranslation } from 'react-i18next';
import type { OrderDto } from '@/types/order';
import { channelProviderName } from '@/lib/externalOrder';
import styles from './MarketplaceOrderQueueSource.module.css';

export default function MarketplaceOrderQueueSource({ order }: { readonly order: OrderDto }) {
  const { t } = useTranslation();
  const source = order.externalOrder;
  if (!source) return null;

  const provider = channelProviderName(source, (key) => t(key));
  const decisionNeeded = source.externalState === 'CREATED' && order.status === 'PendingApproval';

  return (
    <span className={styles.identity} role="group" aria-label={t('marketplaceStaff.order_source', { provider })}>
      <span className={styles.provider}>{provider}</span>
      <span className={styles.displayId} dir="ltr">
        {source.externalDisplayId}
      </span>
      {decisionNeeded && <span className={styles.decision}>{t('marketplaceStaff.decision_needed')}</span>}
    </span>
  );
}

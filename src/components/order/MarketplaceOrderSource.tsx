'use client';

import { useTranslation } from 'react-i18next';
import type { ExternalOrderDto } from '@/types/order';
import { channelProviderName } from '@/lib/externalOrder';
import StatusBadge from '@/components/design-system/StatusBadge';
import styles from './MarketplaceOrderSource.module.css';

export default function MarketplaceOrderSource({ source }: { readonly source?: ExternalOrderDto | null }) {
  const { t } = useTranslation();
  if (!source) return null;
  const provider = channelProviderName(source, (key) => t(key));
  return (
    <section className={styles.source} aria-label={t('delivery_channels.source')}>
      <div className={styles.identity}>
        <strong dir="auto">{provider}</strong>
        <span dir="auto">{source.externalDisplayId}</span>
        {source.isSandbox && (
          <StatusBadge tone="warning" size="sm">
            {t('delivery_channels.test_order')}
          </StatusBadge>
        )}
      </div>
      <p>{t('delivery_channels.payment_handled_by', { provider })}</p>
      {source.customerPhoneAccessCode && (
        <p>
          {t('delivery_channels.phone_access_code')}: <span dir="ltr">{source.customerPhoneAccessCode}</span>
        </p>
      )}
    </section>
  );
}

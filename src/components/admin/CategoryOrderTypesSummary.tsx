import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { orderTypesFromMask } from '@/utils/orderChannels';
import { ORDER_TYPE_LABEL_KEY } from '@/utils/orderTypeLabels';
import styles from './CategoryOrderTypesSummary.module.css';

interface CategoryOrderTypesSummaryProps {
  /** Raw OrderChannels mask; `null`/undefined = every order type. */
  readonly mask: number | null | undefined;
  readonly className?: string;
}

/**
 * A category's effective order types, READ-ONLY, with a link to the one surface that writes them.
 *
 * Deliberately not editable: two components writing one field is a divergence risk (plan §2), so
 * the channel matrix under restaurant settings owns the write and this only reports it.
 */
export default function CategoryOrderTypesSummary({ mask, className }: CategoryOrderTypesSummaryProps) {
  const { t } = useTranslation();

  const labels = orderTypesFromMask(mask)
    .map((orderType) => t(ORDER_TYPE_LABEL_KEY[orderType].key, ORDER_TYPE_LABEL_KEY[orderType].fallback))
    .join(', ');

  return (
    <div className={className}>
      <span className={styles.caption}>{t('product_order_types', 'Order type availability')}</span>
      <p className={styles.value}>
        {labels}{' '}
        <Link href="/admin/restaurant-settings?tab=order-types">{t('category_order_types_manage', 'Manage')}</Link>
      </p>
    </div>
  );
}

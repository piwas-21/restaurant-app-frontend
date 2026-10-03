'use client';

import { useTranslation } from 'react-i18next';
import type { TableGuestItemDto } from '@/types/tableGuestVisit';
import styles from './TableGuestAccount.module.css';

interface TableGuestAccountLineProps {
  readonly item: TableGuestItemDto;
  readonly quantity: number;
  readonly formatPrice: (amount: number) => string;
}

export default function TableGuestAccountLine({ item, quantity, formatPrice }: TableGuestAccountLineProps) {
  const { t } = useTranslation();
  return (
    <li className={styles.itemLine}>
      <div className={styles.itemHeading}>
        <span>
          {quantity} × {item.productName}
          {item.variationName ? ` · ${item.variationName}` : ''}
        </span>
        <span>{formatPrice(item.itemTotal)}</span>
      </div>
      {item.ingredientCustomizations.length > 0 && (
        <ul className={styles.customizations}>
          {item.ingredientCustomizations.map((entry, index) => {
            let label: string;
            if (entry.removed) {
              label = t('table_guest_removed_item', { item: entry.name });
            } else if (entry.addOn) {
              label = t('table_guest_extra_item', { item: entry.name, quantity: entry.quantity });
            } else {
              label = t('table_guest_selected_item', { item: entry.name, quantity: entry.quantity });
            }
            return <li key={`${entry.name}:${index}`}>{label}</li>;
          })}
        </ul>
      )}
      {item.sideItems.length > 0 && (
        <ul className={styles.sideItems}>
          {item.sideItems.map((side) => (
            <TableGuestAccountLine key={side.itemId} item={side} quantity={side.quantity} formatPrice={formatPrice} />
          ))}
        </ul>
      )}
    </li>
  );
}

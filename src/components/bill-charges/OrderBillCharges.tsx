import { useTranslation } from 'react-i18next';
import type { BillCharge } from '@/types/billCharge';
import styles from './BillCharges.module.css';

export default function OrderBillCharges({ charges }: Readonly<{ charges?: readonly BillCharge[] }>) {
  const { i18n } = useTranslation();
  const positive = charges?.filter((charge) => charge.amount !== 0) ?? [];
  if (!positive.length) return null;
  return (
    <dl className={styles.summary}>
      {positive.map((charge) => (
        <div key={charge.key}>
          <dt dir="auto">{charge.label}</dt>
          <dd>
            {new Intl.NumberFormat(i18n.language || 'en', { style: 'currency', currency: charge.currency }).format(
              charge.amount,
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

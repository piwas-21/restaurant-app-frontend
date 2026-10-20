import { useTranslation } from 'react-i18next';
import type { ZReportDiscounts } from '@/types/order/zReport';
import { formatCurrency } from '@/utils/currency';
import styles from './ZReportModal.module.css';

export default function ZReportDiscountRows({ discounts }: Readonly<{ discounts: ZReportDiscounts }>) {
  const { t } = useTranslation();
  return (
    <>
      <tr>
        <td>{t('cashier.zreport.promo_code_discounts')}</td>
        <td>{formatCurrency(discounts.promoCodeDiscounts)}</td>
      </tr>
      <tr>
        <td>{t('cashier.zreport.customer_discounts')}</td>
        <td>{formatCurrency(discounts.customerDiscounts)}</td>
      </tr>
      <tr>
        <td>{t('cashier.zreport.fidelity_discounts')}</td>
        <td>{formatCurrency(discounts.fidelityPointsDiscounts)}</td>
      </tr>
      <tr>
        <td>{t('billCharges.staffDiscounts')}</td>
        <td>{formatCurrency(discounts.staffDiscounts ?? 0)}</td>
      </tr>
      <tr className={styles.totalRow}>
        <td>{t('cashier.zreport.total_discounts')}</td>
        <td>{formatCurrency(discounts.totalDiscounts)}</td>
      </tr>
    </>
  );
}

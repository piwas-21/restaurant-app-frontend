'use client';

import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import StaffButton from '@/components/design-system/StaffButton';
import {
  accountContributionInput,
  formatAccountPaymentMinor,
  parseAccountContributionMinor,
} from '@/lib/accountPaymentMoney';
import styles from './AccountPaymentCollection.module.css';

interface Props {
  readonly dueAmountMinor: number;
  readonly currency: string;
  readonly received: string;
  readonly disabled: boolean;
  readonly onChange: (received: string) => void;
}

/** The calculator is local; change never becomes a tip or recorded contribution. */
export default function AccountPaymentCashCalculator({
  dueAmountMinor,
  currency,
  received,
  disabled,
  onChange,
}: Props) {
  const { t, i18n } = useTranslation();
  const minor = parseAccountContributionMinor(received, currency);
  const insufficient = received !== '' && (minor === null || minor < dueAmountMinor);
  const change = minor !== null && minor >= dueAmountMinor ? minor - dueAmountMinor : 0;
  return (
    <div className={styles.cash}>
      <FormField
        label={t('cashier.cash_received')}
        error={insufficient ? t('cashier.cash_received_too_low') : undefined}
      >
        <input
          inputMode="decimal"
          value={received}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
      </FormField>
      <StaffButton disabled={disabled} onClick={() => onChange(accountContributionInput(dueAmountMinor) ?? '')}>
        {t('cashier.cash_exact')}
      </StaffButton>
      <output aria-live="polite">
        {t('cashier.cash_change')}: {formatAccountPaymentMinor(change, currency, i18n.language || 'en')}
      </output>
    </div>
  );
}

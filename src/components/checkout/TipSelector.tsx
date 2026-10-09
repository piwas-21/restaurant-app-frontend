'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import FormField from '@/components/design-system/FormField';
import { parseCurrencyAmountMinor } from '@/lib/accountPaymentMoney';
import { TENANT_CURRENCY, TENANT_LOCALE, formatCurrency } from '@/utils/currency';
import defaultStyles from './TipSelector.module.css';

interface TipSelectorProps {
  readonly subtotal: number;
  readonly selectedTipAmount: number;
  readonly onTipChange: (amount: number) => void;
  readonly currency?: string;
  readonly locale?: string;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly onValidityChange?: (valid: boolean) => void;
  /** Active-template CSS module (T4 re-skin). Defaults to the classic module. */
  readonly styles?: Readonly<Record<string, string>>;
}

type TipOption = 'none' | 10 | 15 | 20 | 'custom';

function roundTipMinor(amountMinor: number): number {
  const centsPart = amountMinor % 100;
  if (centsPart < 10) return amountMinor - centsPart;
  return amountMinor - (amountMinor % 5);
}

function percentageTipMinor(subtotalMinor: number, percent: number): number {
  return roundTipMinor(Math.round((subtotalMinor * percent) / 100));
}

function formatCustomTipMinor(amountMinor: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export default function TipSelector({
  subtotal,
  selectedTipAmount,
  onTipChange,
  currency = TENANT_CURRENCY,
  locale = TENANT_LOCALE,
  error,
  disabled = false,
  onValidityChange,
  styles = defaultStyles,
}: Readonly<TipSelectorProps>) {
  const { t } = useTranslation();
  const customTipId = useId();
  const [selectedOption, setSelectedOption] = useState<TipOption>('none');
  const [customAmount, setCustomAmount] = useState('');
  const [customAmountInvalid, setCustomAmountInvalid] = useState(false);
  const subtotalMinor = Number.isFinite(subtotal) ? Math.max(0, Math.round(subtotal * 100)) : 0;
  const selectedTipMinor = Number.isFinite(selectedTipAmount) ? Math.max(0, Math.round(selectedTipAmount * 100)) : 0;
  const tip10 = percentageTipMinor(subtotalMinor, 10);
  const tip15 = percentageTipMinor(subtotalMinor, 15);
  const tip20 = percentageTipMinor(subtotalMinor, 20);
  const formatPrice = (minor: number) => formatCurrency(minor / 100, locale, currency);

  useEffect(() => {
    if (customAmountInvalid) return;
    if (selectedTipMinor === 0) {
      setSelectedOption('none');
      setCustomAmount('');
    } else if (selectedTipMinor === tip10) {
      setSelectedOption(10);
      setCustomAmount(formatCustomTipMinor(selectedTipMinor, locale));
    } else if (selectedTipMinor === tip15) {
      setSelectedOption(15);
      setCustomAmount(formatCustomTipMinor(selectedTipMinor, locale));
    } else if (selectedTipMinor === tip20) {
      setSelectedOption(20);
      setCustomAmount(formatCustomTipMinor(selectedTipMinor, locale));
    } else {
      setSelectedOption('custom');
      setCustomAmount(
        new Intl.NumberFormat(locale, {
          useGrouping: false,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(selectedTipMinor / 100),
      );
    }
  }, [customAmountInvalid, locale, selectedTipMinor, tip10, tip15, tip20]);

  const handleOptionClick = (option: TipOption) => {
    if (disabled) return;
    setSelectedOption(option);
    if (option === 'none') {
      onTipChange(0);
      setCustomAmount('');
      setCustomAmountInvalid(false);
      onValidityChange?.(true);
    } else if (option === 'custom') {
      setCustomAmount(selectedTipMinor === 0 ? '' : formatCustomTipMinor(selectedTipMinor, locale));
      setCustomAmountInvalid(false);
      onValidityChange?.(true);
    } else {
      const amount = percentageTipMinor(subtotalMinor, option);
      onTipChange(amount / 100);
      setCustomAmount(formatCustomTipMinor(amount, locale));
      setCustomAmountInvalid(false);
      onValidityChange?.(true);
    }
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    const amount = parseCurrencyAmountMinor(value, currency, locale);
    if (amount !== null) {
      setSelectedOption('custom');
      setCustomAmountInvalid(false);
      onValidityChange?.(true);
      onTipChange(amount / 100);
    } else if (value === '') {
      setCustomAmountInvalid(false);
      onValidityChange?.(true);
      onTipChange(0);
    } else {
      setCustomAmountInvalid(true);
      onValidityChange?.(false);
    }
  };

  const fieldError = customAmountInvalid ? t('cashier.table_bill.error.tip') : error;

  return (
    <div className={styles.tipCard}>
      <div className={styles.tipHeader}>
        <div className={styles.tipHeaderContent}>
          <Heart className={styles.heartIcon} size={20} aria-hidden="true" />
          <h3 className={styles.tipTitle}>{t('tip', 'Tip')}</h3>
        </div>
        <span className={styles.optionalBadge}>{t('tip_optional', 'Optional')}</span>
      </div>
      <div className={styles.tipOptions}>
        {[
          { option: 'none' as const, label: t('no_tip', 'No Tip'), amount: 0 },
          { option: 10 as const, label: '10%', amount: tip10 },
          { option: 15 as const, label: '15%', amount: tip15 },
          { option: 20 as const, label: '20%', amount: tip20 },
        ].map(({ option, label, amount }) => (
          <button
            key={option}
            type="button"
            className={`${styles.tipButton} ${selectedOption === option ? styles.selected : ''}`}
            onClick={() => handleOptionClick(option)}
            aria-label={option === 'none' ? label : `${label} ${formatPrice(amount)}`}
            aria-pressed={selectedOption === option}
            disabled={disabled}
          >
            <span className={option === 'none' ? styles.tipLabel : styles.tipPercentage}>{label}</span>
            {option !== 'none' && <span className={styles.tipAmount}>{formatPrice(amount)}</span>}
          </button>
        ))}
      </div>
      <div className={styles.customTipContainer}>
        <FormField label={`${t('custom_tip', 'Custom Amount')} · ${currency}`} error={fieldError}>
          <input
            id={customTipId}
            inputMode="decimal"
            value={customAmount}
            onChange={(event) => handleCustomAmountChange(event.target.value)}
            placeholder={new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
              0,
            )}
            className={styles.customTipInput}
            aria-label={t('enter_custom_tip', 'Enter custom tip amount')}
            disabled={disabled}
          />
        </FormField>
      </div>
    </div>
  );
}

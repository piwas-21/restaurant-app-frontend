'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import FormField from '@/components/design-system/FormField';
import { parseCurrencyAmountMinor } from '@/lib/accountPaymentMoney';
import { TENANT_CURRENCY, TENANT_LOCALE, formatCurrency } from '@/utils/currency';
import { useRestaurantInfo } from '@/hooks/useRestaurantInfo';
import type { TipPreferences } from '@/types/tipPreferences';
import defaultStyles from './TipSelector.module.css';

interface TipSelectorProps {
  readonly preferences?: TipPreferences;
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

type TipOption = 'none' | number | 'custom';

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
  preferences,
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
  const validityCallbackRef = useRef(onValidityChange);
  const subtotalMinor = Number.isFinite(subtotal) ? Math.max(0, Math.round(subtotal * 100)) : 0;
  const selectedTipMinor = Number.isFinite(selectedTipAmount) ? Math.max(0, Math.round(selectedTipAmount * 100)) : 0;
  const { info, isLoading, error: preferenceError, refetch } = useRestaurantInfo();
  const presetsReady = preferences !== undefined || (info != null && !preferenceError);
  const preferencesLoading = preferences === undefined && isLoading;
  const preferencesUnavailable = preferences === undefined && !isLoading && (!info || preferenceError);
  const configured = preferences ?? info?.tipPreferences;
  const fixed = configured?.mode === 'fixed';
  const presetOptions = useMemo(() => {
    if (!presetsReady) return [];
    const values = fixed
      ? configured?.currency === currency
        ? configured.values
        : []
      : (configured?.values ?? [10, 15, 20]);
    return values.map((value) => ({ option: value, amount: fixed ? value : percentageTipMinor(subtotalMinor, value) }));
  }, [configured, currency, fixed, presetsReady, subtotalMinor]);
  const formatPrice = (minor: number) => formatCurrency(minor / 100, locale, currency);

  useEffect(() => {
    validityCallbackRef.current = onValidityChange;
  }, [onValidityChange]);

  useEffect(() => {
    validityCallbackRef.current?.(!customAmountInvalid);
  }, [customAmountInvalid]);

  useEffect(() => {
    if (customAmountInvalid) return;
    if (selectedTipMinor === 0) {
      setSelectedOption('none');
      setCustomAmount('');
    } else if (presetOptions.some((option) => option.amount === selectedTipMinor)) {
      setSelectedOption(presetOptions.find((option) => option.amount === selectedTipMinor)?.option ?? 'custom');
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
  }, [customAmountInvalid, locale, selectedTipMinor, presetOptions]);

  const handleOptionClick = (option: TipOption) => {
    if (disabled) return;
    setSelectedOption(option);
    if (option === 'none') {
      onTipChange(0);
      setCustomAmount('');
      setCustomAmountInvalid(false);
    } else if (option === 'custom') {
      setCustomAmount(selectedTipMinor === 0 ? '' : formatCustomTipMinor(selectedTipMinor, locale));
      setCustomAmountInvalid(false);
    } else {
      const amount = presetOptions.find((preset) => preset.option === option)?.amount ?? 0;
      onTipChange(amount / 100);
      setCustomAmount(formatCustomTipMinor(amount, locale));
      setCustomAmountInvalid(false);
    }
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    const amount = parseCurrencyAmountMinor(value, currency, locale);
    if (amount !== null) {
      setSelectedOption('custom');
      setCustomAmountInvalid(false);
      onTipChange(amount / 100);
    } else if (value === '') {
      setCustomAmountInvalid(false);
      onTipChange(0);
    } else {
      setCustomAmountInvalid(true);
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
      {preferencesLoading && <p role="status">{t('loading')}</p>}
      {preferencesUnavailable && (
        <div role="alert">
          <p>{t('tip_preferences.load_failed')}</p>
          <button type="button" className={styles.tipButton} disabled={disabled} onClick={() => void refetch()}>
            {t('retry')}
          </button>
        </div>
      )}
      <div className={styles.tipOptions}>
        {[
          { option: 'none' as const, label: t('no_tip', 'No Tip'), amount: 0 },
          ...presetOptions.map((preset) => ({
            ...preset,
            label: fixed ? formatPrice(preset.amount) : `${preset.option}%`,
          })),
        ].map(({ option, label, amount }) => (
          <button
            key={option}
            type="button"
            className={`${styles.tipButton} ${selectedOption === option ? styles.selected : ''}`}
            onClick={() => handleOptionClick(option)}
            aria-label={option === 'none' || fixed ? label : `${label} ${formatPrice(amount)}`}
            aria-pressed={selectedOption === option}
            disabled={disabled}
          >
            <span className={option === 'none' ? styles.tipLabel : styles.tipPercentage}>{label}</span>
            {option !== 'none' && !fixed && <span className={styles.tipAmount}>{formatPrice(amount)}</span>}
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

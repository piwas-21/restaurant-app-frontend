'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBillChargeConfiguration } from '@/hooks/useBillChargeConfiguration';
import { getErrorMessage } from '@/utils/apiClient';
import { saveBillCharges } from '@/services/billChargeService';
import type { BillChargeRule } from '@/types/billCharge';

export function useBillChargeEditor() {
  const { t } = useTranslation();
  const reader = useBillChargeConfiguration();
  const [rules, setRules] = useState<BillChargeRule[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!reader.configuration) return;
    const saved = [...reader.configuration.rules];
    for (const [key, label] of [
      ['service_fee', t('billCharges.serviceFee')],
      ['delivery_fee', t('billCharges.deliveryFee')],
    ]) {
      if (!saved.some((rule) => rule.key === key))
        saved.push({
          key,
          label,
          enabled: false,
          defaultAmount: 0,
          allowCustomAmount: true,
          orderTypes: key === 'delivery_fee' ? ['Delivery'] : ['DineIn', 'Takeaway', 'Delivery'],
          roles: ['Cashier', 'Server'],
        });
    }
    setRules(saved);
  }, [reader.configuration, t]);
  const valid =
    rules.length <= 12 &&
    new Set(rules.map((rule) => rule.key)).size === rules.length &&
    rules.every(
      (rule) =>
        /^[a-z][a-z0-9_]{0,39}$/.test(rule.key) &&
        rule.label.trim().length > 0 &&
        Number.isFinite(rule.defaultAmount) &&
        rule.defaultAmount >= 0 &&
        rule.defaultAmount <= 10000 &&
        rule.orderTypes.length > 0 &&
        rule.roles.length > 0,
    );
  const save = async () => {
    if (!reader.configuration || !valid || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      reader.setConfiguration(await saveBillCharges({ currency: reader.configuration.currency, rules }));
      setMessage('billCharges.saved');
    } catch (error: unknown) {
      setMessage(getErrorMessage(error) ?? 'billCharges.saveFailed');
    } finally {
      setBusy(false);
    }
  };
  return { reader, rules, setRules, busy, message, valid, save };
}

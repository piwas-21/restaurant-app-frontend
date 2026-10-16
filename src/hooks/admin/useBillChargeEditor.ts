'use client';
import { useEffect, useState, type SetStateAction } from 'react';
import { MAX_BILL_CHARGE_FIELDS } from '@/lib/billChargeLimits';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { billChargeSettingsSchema, type BillChargeSettingsForm } from '@/schemas/billCharge.schema';
import { useTranslation } from 'react-i18next';
import { useBillChargeConfiguration } from '@/hooks/useBillChargeConfiguration';
import { getErrorMessage } from '@/utils/apiClient';
import { saveBillCharges } from '@/services/billChargeService';
import type { BillChargeRule } from '@/types/billCharge';

export function useBillChargeEditor() {
  const { t } = useTranslation();
  const reader = useBillChargeConfiguration();
  const { control, reset, setValue, handleSubmit, formState } = useForm<BillChargeSettingsForm>({
    resolver: zodResolver(billChargeSettingsSchema),
    defaultValues: { rules: [] },
    mode: 'onChange',
  });
  const rules = useWatch({ control, name: 'rules' });
  const setRules = (next: SetStateAction<BillChargeRule[]>) =>
    setValue('rules', typeof next === 'function' ? next(rules) : next, { shouldValidate: true, shouldDirty: true });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!reader.configuration) return;
    const saved = [...reader.configuration.rules];
    for (const [key, label] of [
      ['service_fee', t('billCharges.serviceFee')],
      ['delivery_fee', t('billCharges.deliveryFee')],
    ]) {
      if (saved.length < MAX_BILL_CHARGE_FIELDS && !saved.some((rule) => rule.key === key))
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
    reset({ rules: saved });
  }, [reader.configuration, reset, t]);
  const valid = formState.isValid;
  const save = handleSubmit(async (data) => {
    if (!reader.configuration || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      reader.setConfiguration(await saveBillCharges({ currency: reader.configuration.currency, rules: data.rules }));
      setMessage('billCharges.saved');
    } catch (error: unknown) {
      setMessage(getErrorMessage(error) ?? 'billCharges.saveFailed');
    } finally {
      setBusy(false);
    }
  });
  return { reader, rules, setRules, busy, message, valid, save };
}

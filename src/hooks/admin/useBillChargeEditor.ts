'use client';
import { useCallback, useEffect, useState, type SetStateAction } from 'react';
import { MAX_BILL_CHARGE_FIELDS } from '@/lib/billChargeLimits';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
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
  const { fields, append: addRule, remove: removeRule, replace } = useFieldArray({ control, name: 'rules' });
  const setRules = (next: SetStateAction<BillChargeRule[]>) => replace(typeof next === 'function' ? next(rules) : next);
  const changeRule = (index: number, rule: BillChargeRule) =>
    setValue(`rules.${index}`, rule, { shouldValidate: true, shouldDirty: true });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [invalidAmounts, setInvalidAmounts] = useState<readonly string[]>([]);
  const setAmountValid = useCallback((key: string, valid: boolean) => {
    setInvalidAmounts((current) => {
      if (current.includes(key) === !valid) return current;
      return valid ? current.filter((value) => value !== key) : [...current, key];
    });
  }, []);
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
  const valid = formState.isValid && !rules.some((rule) => invalidAmounts.includes(rule.key));
  const selectedIndex = Math.max(
    0,
    rules.findIndex((rule) => rule.key === selectedKey),
  );
  const addCustomRule = () => {
    if (busy || rules.length >= MAX_BILL_CHARGE_FIELDS) return;
    const key = `charge_${crypto.randomUUID().replaceAll('-', '')}`;
    addRule({
      key,
      label: t('billCharges.custom'),
      enabled: false,
      defaultAmount: 0,
      allowCustomAmount: true,
      orderTypes: ['DineIn', 'Takeaway', 'Delivery'],
      roles: ['Cashier', 'Server'],
    });
    setSelectedKey(key);
  };
  const save = handleSubmit(async (data) => {
    if (!reader.configuration || busy || !valid) return;
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
  return {
    reader,
    rules,
    rowIds: fields.map((field) => field.id),
    setRules,
    changeRule,
    addRule,
    removeRule,
    busy,
    message,
    valid,
    save,
    selectedIndex,
    selectRule: setSelectedKey,
    addCustomRule,
    setAmountValid,
  };
}

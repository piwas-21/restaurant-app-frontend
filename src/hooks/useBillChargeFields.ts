'use client';
import { useCallback, useEffect, useState } from 'react';
import { useOptionalAuth } from '@/components/AuthContext';
import { useBillChargeConfiguration } from './useBillChargeConfiguration';
import type { BillChargeInput } from '@/types/billCharge';

export function useBillChargeFields(
  orderType: string,
  values: readonly BillChargeInput[],
  existingKeys: readonly string[],
  onValidityChange?: (valid: boolean) => void,
) {
  const auth = useOptionalAuth();
  const reader = useBillChargeConfiguration();
  const role = auth?.user?.role?.toLowerCase();
  const [invalidKeys, setInvalidKeys] = useState<readonly string[]>([]);
  const rules =
    reader.configuration?.rules.filter(
      (rule) =>
        rule.enabled &&
        (rule.orderTypes as readonly string[]).includes(orderType) &&
        (role === 'admin' || rule.roles.some((r) => r.toLowerCase() === role)) &&
        !existingKeys.includes(rule.key),
    ) ?? [];
  const unavailable = values.filter(
    (value) =>
      !rules.some(
        (rule) =>
          rule.key === value.key &&
          (value.effect ?? 'Increase') === (rule.effect ?? 'Increase') &&
          (value.calculation ?? 'Fixed') === (rule.calculation ?? 'Fixed'),
      ),
  );
  const valid = unavailable.length === 0 && !values.some((value) => invalidKeys.includes(value.key));
  const setValid = useCallback(
    (key: string, isValid: boolean) =>
      setInvalidKeys((keys) => {
        if (keys.includes(key) === !isValid) return keys;
        return isValid ? keys.filter((value) => value !== key) : [...keys, key];
      }),
    [],
  );
  useEffect(() => {
    onValidityChange?.(valid);
  }, [onValidityChange, valid]);
  return { reader, rules, unavailable, setValid, valid };
}

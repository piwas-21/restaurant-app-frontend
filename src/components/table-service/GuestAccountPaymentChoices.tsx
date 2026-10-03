'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AccountPaymentAllocation } from '@/types/accountPayments';
import type { TableGuestAccountDto } from '@/types/tableGuestVisit';
import type { GuestAccountPaymentAccount, GuestPaymentEqualShareSummary } from '@/types/guestAccountPayments';
import { accountAllocationKey } from '@/lib/accountPaymentSelection';
import { formatAccountPaymentMinor } from '@/lib/accountPaymentMoney';
import { canCreateGuestEqualSharePlan } from '@/lib/guestAccountPaymentRules';
import FormField from '@/components/design-system/FormField';
import styles from './GuestAccountPayment.module.css';

export function AllocationChoices({
  account,
  tableAccount,
  quantities,
  onQuantityChange,
}: Readonly<{
  account: GuestAccountPaymentAccount;
  tableAccount: TableGuestAccountDto | null;
  quantities: Readonly<Record<string, number>>;
  onQuantityChange: (key: string, value: number) => void;
}>) {
  const { t, i18n } = useTranslation();
  const allocations = account.availableAllocations.filter((value) => value.orderItemId !== null && value.unitCount > 0);
  if (allocations.length === 0) return <p className={styles.muted}>{t('table_guest_payment_items_empty')}</p>;
  return (
    <div className={styles.choiceList}>
      {allocations.map((allocation) => (
        <AllocationChoice
          key={accountAllocationKey(allocation)}
          allocation={allocation}
          account={account}
          tableAccount={tableAccount}
          quantity={quantities[accountAllocationKey(allocation)] ?? 0}
          onQuantityChange={(value) => onQuantityChange(accountAllocationKey(allocation), value)}
          language={i18n.language}
        />
      ))}
    </div>
  );
}

function AllocationChoice({
  allocation,
  account,
  tableAccount,
  quantity,
  onQuantityChange,
  language,
}: Readonly<{
  allocation: AccountPaymentAllocation;
  account: GuestAccountPaymentAccount;
  tableAccount: TableGuestAccountDto | null;
  quantity: number;
  onQuantityChange: (value: number) => void;
  language: string;
}>) {
  const { t } = useTranslation();
  const line = tableAccount?.items.find(
    (value) => value.orderId === allocation.orderId && value.item.itemId === allocation.orderItemId,
  );
  const orderNumber =
    tableAccount?.orders.find((value) => value.orderId === allocation.orderId)?.orderNumber ??
    t('table_guest_payment_unknown_order');
  const name = line?.item.productName ?? t('table_guest_payment_order_item', { orderNumber });
  const perUnit = formatAccountPaymentMinor(allocation.minorPerUnit, account.currency, language);
  return (
    <div className={styles.choice}>
      <div className={styles.choiceBody}>
        <strong>{name}</strong>
        <span className={styles.choiceMeta}>
          {orderNumber} · {t('table_guest_payment_quantity', { count: allocation.unitCount })}
        </span>
        {perUnit && <span className={styles.choiceMeta}>{perUnit}</span>}
      </div>
      <FormField label={t('table_guest_payment_units')}>
        <input
          className={styles.numberInput}
          type="number"
          min={0}
          max={allocation.unitCount}
          step={1}
          value={quantity}
          aria-label={t('table_guest_payment_select_units', { item: name })}
          onChange={(event) => {
            const value = event.target.value === '' ? 0 : Number(event.target.value);
            onQuantityChange(Number.isSafeInteger(value) && value >= 0 ? value : 0);
          }}
        />
      </FormField>
    </div>
  );
}

export function EqualShareChoices({
  account,
  activePlan,
  disabled,
  shareCount,
  shareOrdinal,
  onShareCountChange,
  onShareOrdinalChange,
  onCreatePlan,
}: Readonly<{
  account: GuestAccountPaymentAccount;
  activePlan: GuestPaymentEqualShareSummary | null;
  disabled: boolean;
  shareCount: number;
  shareOrdinal: number | null;
  onShareCountChange: (count: number) => void;
  onShareOrdinalChange: (ordinal: number | null) => void;
  onCreatePlan: (count: number) => Promise<boolean>;
}>) {
  const { t, i18n } = useTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const available = activePlan?.slots.filter((slot) => slot.isAvailable) ?? [];
  const mayCreate = !activePlan || activePlan.isOwnPlan;
  const canCreatePlan = canCreateGuestEqualSharePlan(account, shareCount);
  const createPlan = async () => {
    setIsCreating(true);
    try {
      await onCreatePlan(shareCount);
    } finally {
      setIsCreating(false);
    }
  };
  return (
    <fieldset className={styles.choices}>
      {activePlan && available.length > 0 && (
        <>
          <legend>{t('table_guest_payment_choose_share')}</legend>
          <div className={styles.choiceList}>
            {available.map((slot) => (
              <label className={styles.modeOption} key={slot.ordinal}>
                <input
                  type="radio"
                  name="guest-payment-share"
                  checked={shareOrdinal === slot.ordinal}
                  onChange={() => onShareOrdinalChange(slot.ordinal)}
                />
                <span>
                  {t('table_guest_payment_share', {
                    ordinal: slot.ordinal,
                    amount: formatAccountPaymentMinor(slot.amountMinor, activePlan.currency, i18n.language),
                  })}
                </span>
              </label>
            ))}
          </div>
          {activePlan.isOwnPlan && <p className={styles.muted}>{t('table_guest_payment_share_plan_owned')}</p>}
        </>
      )}
      {activePlan && available.length === 0 && <p className={styles.muted}>{t('table_guest_payment_no_shares')}</p>}
      {mayCreate && (
        <div className={styles.choiceList}>
          <FormField label={t('table_guest_payment_share_count')}>
            <input
              className={styles.numberInput}
              type="number"
              min={2}
              max={account.limits.maximumEqualShares}
              value={shareCount}
              onChange={(event) => onShareCountChange(Number(event.target.value))}
            />
          </FormField>
          <button
            type="button"
            className={styles.button}
            disabled={disabled || isCreating || !canCreatePlan}
            onClick={() => void createPlan()}
          >
            {t(activePlan?.isOwnPlan ? 'table_guest_payment_update_plan' : 'table_guest_payment_create_plan')}
          </button>
        </div>
      )}
    </fieldset>
  );
}

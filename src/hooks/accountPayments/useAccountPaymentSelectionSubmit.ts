'use client';

import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import type { AccountPaymentAccount } from '@/types/accountPaymentAccount';
import type {
  AccountManualPaymentMethod,
  CreateAccountEqualSharePlanRequest,
  CreateAccountPaymentQuoteRequest,
} from '@/types/accountPayments';
import { selectAccountPaymentUnits } from '@/lib/accountPaymentSelection';
import { formatAccountPaymentMinor, parseAccountContributionMinor } from '@/lib/accountPaymentMoney';
import type { AccountPaymentChoice } from '@/components/account-payments/AccountPaymentShareFields';

type PaymentBase = Pick<
  CreateAccountPaymentQuoteRequest,
  'operationId' | 'expectedAccountRevision' | 'paymentMethod' | 'tipMinor'
>;
type SharePlan = AccountPaymentAccount['activeEqualSharePlan'];

interface Input {
  readonly account: AccountPaymentAccount;
  readonly choice: AccountPaymentChoice;
  readonly method: AccountManualPaymentMethod;
  readonly amount: string;
  readonly tip: string;
  readonly shares: string;
  readonly ordinal: string;
  readonly customAmounts: readonly string[];
  readonly quantities: Readonly<Record<string, number>>;
  readonly locale: string;
  readonly plan: SharePlan;
  readonly planMatchesChoice: boolean;
  readonly tipValid: boolean;
  readonly disabled: boolean;
  readonly onQuote: (request: CreateAccountPaymentQuoteRequest) => Promise<void>;
  readonly onPlan: (request: CreateAccountEqualSharePlanRequest) => Promise<void>;
  readonly onError: (message: string) => void;
  readonly onCustomSharesAttempted: () => void;
}

export function useAccountPaymentSelectionSubmit(input: Input) {
  const { t } = useTranslation();
  const createSharePlan = async () => {
    const shareCount = Number(input.shares);
    const validShareCount =
      Number.isSafeInteger(shareCount) &&
      shareCount >= 2 &&
      shareCount <= input.account.limits.maximumEqualShares &&
      shareCount <= input.account.availableMinor;
    if (!validShareCount) {
      input.onError(t('accountPayments.invalid_shares'));
      return;
    }
    const request: CreateAccountEqualSharePlanRequest = {
      operationId: crypto.randomUUID(),
      expectedAccountRevision: input.account.accountRevision,
      shareCount,
      ...(input.plan ? { supersedesPlanId: input.plan.planId } : {}),
    };
    if (input.choice === 'CustomAmount') {
      input.onCustomSharesAttempted();
      const amounts = input.customAmounts
        .slice(0, shareCount)
        .map((value) => parseAccountContributionMinor(value, input.account.currency, input.locale));
      const totalAmount = amounts.reduce<number>((sum, value) => sum + (value ?? 0), 0);
      const amountsAreValid =
        amounts.length === shareCount &&
        amounts.every((value) => value !== null && Number.isSafeInteger(value) && value > 0) &&
        Number.isSafeInteger(totalAmount);
      if (!amountsAreValid) {
        input.onError(t('accountPayments.custom_amounts_must_match_balance'));
        return;
      }
      if (totalAmount !== input.account.availableMinor) {
        input.onError(
          t(
            totalAmount > input.account.availableMinor
              ? 'accountPayments.custom_balance_over'
              : 'accountPayments.custom_balance_remaining',
            {
              amount:
                formatAccountPaymentMinor(
                  Math.abs(input.account.availableMinor - totalAmount),
                  input.account.currency,
                  input.locale,
                ) ?? String(Math.abs(input.account.availableMinor - totalAmount)),
            },
          ),
        );
        return;
      }
      request.customAmountsMinor = amounts.filter((value): value is number => value !== null);
    }
    await input.onPlan(request);
  };

  const quoteShare = async (paymentBase: PaymentBase) => {
    const plan = input.plan;
    const slot = plan?.slots.find((value) => value.ordinal === Number(input.ordinal) && value.isAvailable);
    if (!plan || !slot) {
      input.onError(t('accountPayments.choose_share'));
      return;
    }
    const request =
      input.choice === 'Equal'
        ? { ...paymentBase, mode: 'Equal' as const, equalSharePlanId: plan.planId, equalShareOrdinal: slot.ordinal }
        : {
            ...paymentBase,
            mode: 'CustomAmount' as const,
            customSharePlanId: plan.planId,
            customShareOrdinal: slot.ordinal,
          };
    await input.onQuote(request);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (input.disabled) return;
    input.onError('');
    if (!input.tipValid) {
      input.onError(t('cashier.table_bill.error.tip'));
      return;
    }
    const base = {
      operationId: crypto.randomUUID(),
      expectedAccountRevision: input.account.accountRevision,
      paymentMethod: input.method,
    };
    const isSplitChoice = input.choice === 'Equal' || input.choice === 'CustomAmount';
    if (isSplitChoice && !input.planMatchesChoice) {
      await createSharePlan();
      return;
    }
    const tipMinor = parseAccountContributionMinor(input.tip || '0', input.account.currency, input.locale);
    if (tipMinor === null) {
      input.onError(t('cashier.table_bill.error.tip'));
      return;
    }
    const paymentBase = { ...base, tipMinor };
    if (isSplitChoice && input.planMatchesChoice) {
      await quoteShare(paymentBase);
      return;
    }
    if (input.choice === 'Items') {
      const selectedUnits = selectAccountPaymentUnits(
        input.account.availableAllocations,
        input.quantities,
        input.account.limits.maximumSelectedUnits,
      );
      if (!selectedUnits) {
        input.onError(t('accountPayments.choose_items'));
        return;
      }
      await input.onQuote({ ...paymentBase, mode: 'Items', selectedUnits });
      return;
    }
    if (input.choice === 'Full') {
      await input.onQuote({ ...paymentBase, mode: 'Full' });
      return;
    }
    const amountMinor = parseAccountContributionMinor(input.amount, input.account.currency, input.locale);
    if (amountMinor === null || amountMinor <= 0 || amountMinor > input.account.availableMinor) {
      input.onError(t('accountPayments.invalid_amount'));
      return;
    }
    await input.onQuote({ ...paymentBase, mode: 'Amount', amountMinor });
  };

  return submit;
}

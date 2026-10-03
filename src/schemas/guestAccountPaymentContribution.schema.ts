import { z } from 'zod';
import { selectAccountPaymentUnits } from '@/lib/accountPaymentSelection';
import { parseAccountContributionMinor } from '@/lib/accountPaymentMoney';
import type { AccountPaymentUnitSelection } from '@/types/accountPayments';
import type { GuestAccountPaymentAccount, GuestPaymentEqualShareSummary } from '@/types/guestAccountPayments';

const contributionInputSchema = z
  .object({
    mode: z.enum(['Amount', 'Items', 'Equal']),
    amountInput: z.string(),
    quantities: z.record(z.string(), z.number().int().nonnegative()),
    shareOrdinal: z.number().int().nullable(),
  })
  .strict();

export type GuestAccountPaymentContributionFormValues = z.infer<typeof contributionInputSchema>;
export type GuestAccountPaymentContributionQuote =
  | { mode: 'Amount'; paymentMethod: 'OnlinePayment'; amountMinor: number }
  | { mode: 'Items'; paymentMethod: 'OnlinePayment'; selectedUnits: readonly AccountPaymentUnitSelection[] }
  | { mode: 'Equal'; paymentMethod: 'OnlinePayment'; equalSharePlanId: string; equalShareOrdinal: number };

export function createGuestAccountPaymentContributionSchema(
  account: GuestAccountPaymentAccount,
  activePlan: GuestPaymentEqualShareSummary | null,
) {
  return contributionInputSchema
    .superRefine((input, context) => {
      const limits = account.limits.online;
      if (!limits) {
        addError(context, 'invalid_amount', 'amountInput');
        return;
      }
      if (input.mode === 'Amount') {
        const amount = parseAccountContributionMinor(input.amountInput, limits.currency);
        if (amount === null || amount <= 0) addError(context, 'invalid_amount', 'amountInput');
        else if (amount < limits.minimumAmountMinor) addError(context, 'minimum', 'amountInput');
        else if (amount > limits.maximumAmountMinor || amount > account.availableMinor)
          addError(context, 'maximum', 'amountInput');
        return;
      }
      if (input.mode === 'Items') {
        const selected = selectAccountPaymentUnits(
          account.availableAllocations.filter((allocation) => allocation.orderItemId !== null),
          input.quantities,
          account.limits.maximumSelectedUnits,
        );
        validateUnits(selected, account, context);
        return;
      }
      const share = activePlan?.slots.find((slot) => slot.ordinal === input.shareOrdinal && slot.isAvailable);
      if (!activePlan || !share) addError(context, 'select_share', 'shareOrdinal');
      else if (!Number.isSafeInteger(share.amountMinor) || share.amountMinor <= 0)
        addError(context, 'select_share', 'shareOrdinal');
      else if (share.amountMinor < limits.minimumAmountMinor) addError(context, 'minimum', 'shareOrdinal');
      else if (share.amountMinor > limits.maximumAmountMinor || share.amountMinor > account.availableMinor)
        addError(context, 'maximum', 'shareOrdinal');
    })
    .transform((input) => toQuote(input, account, activePlan));
}

function toQuote(
  input: GuestAccountPaymentContributionFormValues,
  account: GuestAccountPaymentAccount,
  activePlan: GuestPaymentEqualShareSummary | null,
): GuestAccountPaymentContributionQuote {
  if (input.mode === 'Amount') {
    return {
      mode: 'Amount',
      paymentMethod: 'OnlinePayment',
      amountMinor: parseAccountContributionMinor(input.amountInput, account.currency) ?? 0,
    };
  }
  if (input.mode === 'Items') {
    const selectedUnits = selectAccountPaymentUnits(
      account.availableAllocations.filter((allocation) => allocation.orderItemId !== null),
      input.quantities,
      account.limits.maximumSelectedUnits,
    );
    return { mode: 'Items', paymentMethod: 'OnlinePayment', selectedUnits: selectedUnits ?? [] };
  }
  const selectedShare = activePlan?.slots.find((slot) => slot.ordinal === input.shareOrdinal && slot.isAvailable);
  return {
    mode: 'Equal',
    paymentMethod: 'OnlinePayment',
    equalSharePlanId: activePlan?.planId ?? '',
    equalShareOrdinal: selectedShare?.ordinal ?? 0,
  };
}

function validateUnits(
  units: readonly AccountPaymentUnitSelection[] | null,
  account: GuestAccountPaymentAccount,
  context: z.RefinementCtx,
): void {
  if (!units || units.length === 0 || units.length > account.limits.maximumSelectedUnits) {
    addError(context, 'select_units', 'quantities');
    return;
  }
  const seen = new Set<string>();
  let amount = 0;
  for (const unit of units) {
    const identity = `${unit.orderId.toLowerCase()}:${unit.orderItemId.toLowerCase()}:${unit.ordinal}`;
    const allocation = account.availableAllocations.find(
      (candidate) =>
        candidate.orderItemId?.toLowerCase() === unit.orderItemId.toLowerCase() &&
        candidate.orderId.toLowerCase() === unit.orderId.toLowerCase() &&
        Number.isSafeInteger(candidate.startOrdinal + candidate.unitCount) &&
        unit.ordinal >= candidate.startOrdinal &&
        unit.ordinal < candidate.startOrdinal + candidate.unitCount,
    );
    if (
      !allocation ||
      seen.has(identity) ||
      !Number.isSafeInteger(allocation.minorPerUnit) ||
      allocation.minorPerUnit <= 0
    ) {
      addError(context, 'select_units', 'quantities');
      return;
    }
    seen.add(identity);
    amount += allocation.minorPerUnit;
    if (!Number.isSafeInteger(amount)) {
      addError(context, 'select_units', 'quantities');
      return;
    }
  }
  const limits = account.limits.online;
  if (!limits) addError(context, 'select_units', 'quantities');
  else if (amount < limits.minimumAmountMinor) addError(context, 'minimum', 'quantities');
  else if (amount > limits.maximumAmountMinor || amount > account.availableMinor)
    addError(context, 'maximum', 'quantities');
}

function addError(context: z.RefinementCtx, message: string, path: string): void {
  context.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
}

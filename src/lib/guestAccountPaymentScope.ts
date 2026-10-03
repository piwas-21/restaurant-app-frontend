import type { AccountPaymentAllocation, AccountPaymentUnitSelection } from '@/types/accountPayments';
import type { GuestAccountPaymentAccount, GuestAccountPaymentQuoteDescriptor } from '@/types/guestAccountPayments';
import {
  amountAllocations,
  hasDuplicateUnits,
  isCoveredBy,
  subtractAllocations,
  totalGuestPaymentAllocations,
} from './guestAccountPaymentAllocationMath';

export function expectedGuestPaymentAllocations(
  account: GuestAccountPaymentAccount,
  quote: GuestAccountPaymentQuoteDescriptor,
): readonly AccountPaymentAllocation[] | null {
  if (quote.mode === 'Items') return selectedAllocations(account, quote.selectedUnits ?? []);
  if (quote.mode === 'Amount') {
    return Number.isSafeInteger(quote.amountMinor) && quote.amountMinor !== undefined
      ? amountAllocations(account.availableAllocations, quote.amountMinor)
      : null;
  }
  return equalShareAllocations(account, quote.equalSharePlanId, quote.equalShareOrdinal);
}

function selectedAllocations(
  account: GuestAccountPaymentAccount,
  units: readonly AccountPaymentUnitSelection[],
): AccountPaymentAllocation[] | null {
  if (!units.length || units.length > account.limits.maximumSelectedUnits || hasDuplicateUnits(units)) return null;
  const result: AccountPaymentAllocation[] = [];
  for (const unit of units) {
    const source = account.availableAllocations.find(
      (allocation) =>
        allocation.orderId.toLowerCase() === unit.orderId.toLowerCase() &&
        allocation.orderItemId?.toLowerCase() === unit.orderItemId.toLowerCase() &&
        allocation.startOrdinal <= unit.ordinal &&
        unit.ordinal < allocation.startOrdinal + allocation.unitCount,
    );
    if (!source || source.minorPerUnit <= 0) return null;
    result.push({
      orderId: source.orderId,
      orderItemId: source.orderItemId,
      startOrdinal: unit.ordinal,
      unitCount: 1,
      minorPerUnit: source.minorPerUnit,
      amountMinor: source.minorPerUnit,
    });
  }
  return result;
}

function equalShareAllocations(
  account: GuestAccountPaymentAccount,
  planId: string | undefined,
  ordinal: number | undefined,
): AccountPaymentAllocation[] | null {
  const plan = account.activeEqualSharePlan;
  if (
    !plan ||
    !planId ||
    plan.planId.toLowerCase() !== planId.toLowerCase() ||
    plan.accountRevision !== account.accountRevision ||
    !Number.isSafeInteger(ordinal) ||
    ordinal === undefined ||
    ordinal < 1 ||
    ordinal > plan.slots.length ||
    !plan.slots[ordinal - 1]?.isAvailable
  )
    return null;
  const total = totalGuestPaymentAllocations(plan.scope);
  if (total === null || total !== plan.totalMinor || total < plan.slots.length) return null;
  const base = Math.floor(total / plan.slots.length);
  const remainder = total % plan.slots.length;
  const amount = base + (ordinal <= remainder ? 1 : 0);
  const prefix = base * (ordinal - 1) + Math.min(remainder, ordinal - 1);
  const skipped = prefix === 0 ? [] : amountAllocations(plan.scope, prefix);
  if (!skipped) return null;
  const remaining = subtractAllocations(plan.scope, skipped);
  const share = amountAllocations(remaining, amount);
  return share && isCoveredBy(account.availableAllocations, share) ? share : null;
}

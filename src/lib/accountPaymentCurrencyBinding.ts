import { z } from 'zod';
import type { AccountPaymentAccount } from '@/types/accountPaymentAccount';
import type { TableServiceSessionDto } from '@/types/order';
import { accountPaymentCurrency } from './accountPaymentMoney';

const visitId = z.string().uuid();

function canonicalCurrency(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const currency = accountPaymentCurrency(value);
  return value === currency ? currency : null;
}

function belongsToVisit(session: TableServiceSessionDto, account?: AccountPaymentAccount | null): boolean {
  const id = session.serviceSessionId;
  if (!visitId.safeParse(id).success) return false;
  const relatedIds = [session.bill?.serviceSessionId, account?.serviceSessionId];
  return relatedIds.every(
    (value) =>
      value === null ||
      value === undefined ||
      (visitId.safeParse(value).success && value.toLowerCase() === id.toLowerCase()),
  );
}

/** New reviews require agreement between explicit visit, bill, and any loaded account. */
export function accountPaymentVisitCurrency(
  session: TableServiceSessionDto,
  account?: AccountPaymentAccount | null,
): string | null {
  if (!belongsToVisit(session, account)) return null;
  const currency = canonicalCurrency(session.currency);
  if (!currency || canonicalCurrency(session.bill?.currency) !== currency) return null;
  return account && canonicalCurrency(account.currency) !== currency ? null : currency;
}

/** Recovery uses the saved review; every currently declared visit currency must still agree. */
export function accountPaymentCurrencyMatchesSaved(
  currency: string,
  savedCurrency: string | undefined,
  session: TableServiceSessionDto,
): boolean {
  if (!belongsToVisit(session)) return false;
  const frozen = canonicalCurrency(savedCurrency);
  if (!frozen || canonicalCurrency(currency) !== frozen) return false;
  return [session.currency, session.bill?.currency].every(
    (value) => value === null || value === undefined || canonicalCurrency(value) === frozen,
  );
}

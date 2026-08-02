import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OrderStatus } from '@/types/order';
import { ACTIVE_STATUSES, PAST_STATUSES } from '../constants/orderStatus';
import {
  ORDER_STATUS_META,
  ORDER_STATUS_TRANSITIONS,
  nextOrderStatuses,
  orderStatusLabel,
  orderStatusMeta,
  paymentStatusLabel,
  resolveOrderStatus,
} from './orderStatus';

const ALL_STATUSES = Object.keys(ORDER_STATUS_META) as OrderStatus[];
const echo = (key: string) => key;

describe('ORDER_STATUS_META', () => {
  // The whole reason this is a Record and not a function with a `default`. The maps it replaces
  // handled eight of the union's members and let the rest fall through to raw untranslated English
  // — silently, because a `default` cannot fail.
  it('covers every member of the OrderStatus union', () => {
    // If the union grows, this file will not compile before it can fail — which is the point. This
    // assertion guards the reverse: a member deleted from the map without touching the union.
    expect(ALL_STATUSES.length).toBeGreaterThanOrEqual(12);
    for (const status of ALL_STATUSES) {
      expect(ORDER_STATUS_META[status].i18nKey).toMatch(/^order_status_/);
      expect(ORDER_STATUS_META[status].className).toMatch(/^status/);
    }
  });

  /**
   * Every status must live in exactly one `/orders` tab. A status in NEITHER is an order the
   * customer cannot find under Active or under Past — it disappears from the page.
   *
   * This had happened twice, and both are in the table below: `OutForDelivery` (the backend's real
   * name for a delivery in transit, which this app assumed was called `InTransit`) and `Refunded`
   * (excluded by a comment asserting it was "a PaymentStatus, not an OrderStatus" — it is both).
   */
  it.each(ALL_STATUSES)('%s belongs to exactly one /orders tab', (status) => {
    const inActive = ACTIVE_STATUSES.includes(status);
    const inPast = PAST_STATUSES.includes(status);
    expect(inActive || inPast).toBe(true);
    expect(inActive && inPast).toBe(false);
  });

  it('every i18n key resolves in all ten locales', () => {
    const locales = ['en', 'de', 'tr', 'it', 'ar', 'fr', 'nl', 'es', 'ru', 'zh'];
    for (const locale of locales) {
      const messages = JSON.parse(readFileSync(join(__dirname, `../locales/${locale}.json`), 'utf8')) as Record<
        string,
        string
      >;
      for (const status of ALL_STATUSES) {
        expect(messages[ORDER_STATUS_META[status].i18nKey]?.trim()).toBeTruthy();
      }
    }
  });
});

describe('resolveOrderStatus', () => {
  // The four ladders being replaced each normalised differently — `'in transit'`, `'intransit'` and
  // `'InTransit'` all appear in the code removed here — so a status in an unexpected casing used to
  // land on whichever default that particular file had.
  it.each([
    ['InTransit', 'InTransit'],
    ['intransit', 'InTransit'],
    ['in transit', 'InTransit'],
    ['OUTFORDELIVERY', 'OutForDelivery'],
    ['In Progress', 'In Progress'],
    ['inprogress', 'In Progress'],
  ])('%s -> %s', (input, expected) => {
    expect(resolveOrderStatus(input)).toBe(expected);
  });

  it.each([null, undefined, '', 'NotAStatus'])('returns null for %p', (input) => {
    expect(resolveOrderStatus(input as string)).toBeNull();
  });
});

describe('orderStatusLabel', () => {
  it('returns the mapped key for a known status', () => {
    expect(orderStatusLabel('Ready', echo)).toBe('order_status_ready');
  });

  // OutForDelivery and InTransit are the same thing under two names, so they must read identically.
  it('gives OutForDelivery the same copy as InTransit', () => {
    expect(orderStatusLabel('OutForDelivery', echo)).toBe(orderStatusLabel('InTransit', echo));
  });

  /**
   * An unknown status returns the SERVER's own word, not a guess. The previous ladders defaulted to
   * "Pending" for the class and colour, which could tell a cashier an order was waiting when it had
   * in fact been cancelled.
   */
  it('returns the raw value for an unknown status rather than defaulting', () => {
    expect(orderStatusLabel('SomeFutureStatus', echo)).toBe('SomeFutureStatus');
    expect(orderStatusMeta('SomeFutureStatus')).toBeNull();
  });

  it('returns an empty string for a missing status', () => {
    expect(orderStatusLabel(null, echo)).toBe('');
  });
});

describe('paymentStatusLabel', () => {
  it.each([
    ['Paid', 'payment_status_paid'],
    ['PartiallyPaid', 'payment_status_partially_paid'],
    ['partiallypaid', 'payment_status_partially_paid'],
  ])('%s -> %s', (input, expected) => {
    expect(paymentStatusLabel(input, echo)).toBe(expected);
  });

  // `Overpaid` is a real backend PaymentStatus the frontend union still omits — it falls through to
  // the raw value here and is special-cased by `useOrderHelpers`. Pinned so the gap stays visible
  // until the contract is reconciled.
  it('falls through for Overpaid, which the union does not yet carry', () => {
    expect(paymentStatusLabel('Overpaid', echo)).toBe('Overpaid');
  });

  it('returns an empty string for a missing payment status', () => {
    expect(paymentStatusLabel(null, echo)).toBe('');
    expect(paymentStatusLabel(undefined, echo)).toBe('');
  });
});

/**
 * The transition table. It mirrors the backend's `IsValidStatusTransition` — the only authority on
 * what the server will accept — and the cashier dialog's own `switch`, which this replaces,
 * disagreed with it in six of eleven states.
 */
describe('nextOrderStatuses', () => {
  it.each([
    ['Pending', ['Confirmed', 'PendingApproval', 'Cancelled']],
    ['PendingApproval', ['Confirmed', 'Cancelled']],
    ['Confirmed', ['Preparing', 'Cancelled']],
    ['Preparing', ['Ready', 'Cancelled']],
    ['Ready', ['OutForDelivery', 'Completed', 'Cancelled']],
    ['OutForDelivery', ['Completed', 'Cancelled']],
  ])('%s -> %s', (status, expected) => {
    expect(nextOrderStatuses(status)).toEqual(expected);
  });

  it.each(['Completed', 'Cancelled', 'Refunded', 'Delivered', 'InTransit', 'In Progress'])(
    '%s is terminal — nothing is offered',
    (status) => {
      expect(nextOrderStatuses(status)).toEqual([]);
    },
  );

  /**
   * The two the cashier stranded. Its ladder's `default` returned `[]`, which is indistinguishable
   * from "this order is finished" — so an order the SERVER had moved into one of these states could
   * not be moved again from the till.
   */
  it('offers a way out of the two states the old ladder stranded', () => {
    expect(nextOrderStatuses('PendingApproval')).not.toHaveLength(0);
    expect(nextOrderStatuses('OutForDelivery')).not.toHaveLength(0);
  });

  /**
   * The one that mattered most on the floor: a delivery could never be DISPATCHED, because `Ready`
   * did not offer `OutForDelivery`.
   */
  it('lets a ready order be sent out for delivery', () => {
    expect(nextOrderStatuses('Ready')).toContain('OutForDelivery');
  });

  it('offers nothing the server would reject — every target is itself a known status', () => {
    // The old ladder offered `InTransit -> Delivered` and `Delivered -> Completed`, both of which
    // the server refuses. Asserting every target round-trips through `resolveOrderStatus` is what
    // stops a future edit reintroducing a target that only exists in this file.
    for (const targets of Object.values(ORDER_STATUS_TRANSITIONS)) {
      for (const target of targets) expect(resolveOrderStatus(target)).toBe(target);
    }
  });

  it('normalises the incoming status the same way labels and badges do', () => {
    expect(nextOrderStatuses('outfordelivery')).toEqual(['Completed', 'Cancelled']);
  });

  it('returns nothing for an unknown status rather than guessing a path', () => {
    expect(nextOrderStatuses('SomeFutureStatus')).toEqual([]);
    expect(nextOrderStatuses(null)).toEqual([]);
  });
});

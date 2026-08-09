import { renderHook } from '@testing-library/react';
import { OrderType } from '@/types/order';
import type { ItemAvailability } from '@/types/menu';
import { isItemBlocked, useItemAvailabilityNotice } from './useItemAvailabilityNotice';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useTableContext } from '@/contexts/TableContext';
import { useEnabledOrderTypes } from '@/hooks/checkout/useEnabledOrderTypes';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    // Interpolate for real so an assertion on the rendered sentence proves the interpolation ran.
    t: (key: string, fallback?: unknown, vars?: Record<string, string>) => {
      const template = typeof fallback === 'string' ? fallback : key;
      if (!vars) return template;
      return Object.entries(vars).reduce((out, [name, value]) => out.replaceAll(`{{${name}}}`, value), template);
    },
  }),
}));

jest.mock('@/contexts/OrderTypeContext', () => ({ useOrderType: jest.fn() }));
jest.mock('@/contexts/TableContext', () => ({ useTableContext: jest.fn() }));
jest.mock('@/hooks/checkout/useEnabledOrderTypes', () => ({ useEnabledOrderTypes: jest.fn() }));

const mockOrderType = useOrderType as jest.Mock;
const mockTableContext = useTableContext as jest.Mock;
const mockEnabled = useEnabledOrderTypes as jest.Mock;

const ALL: OrderType[] = [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery];

/** Takeaway + Delivery, i.e. the client's "Dürüm cannot be dine-in" case. */
const NOT_DINE_IN: ItemAvailability = {
  canOrder: true,
  reason: 'Available',
  allowedOrderTypes: [OrderType.Takeaway, OrderType.Delivery],
};

function setup({
  orderType = null,
  hasTableContext = false,
  enabled = ALL,
  loading = false,
}: {
  orderType?: OrderType | null;
  hasTableContext?: boolean;
  enabled?: OrderType[];
  loading?: boolean;
} = {}) {
  mockOrderType.mockReturnValue({ state: { orderType } });
  mockTableContext.mockReturnValue({ hasTableContext });
  mockEnabled.mockReturnValue({ enabled, loading });
}

function notice(availability: ItemAvailability | undefined) {
  return renderHook(() => useItemAvailabilityNotice(availability)).result.current;
}

beforeEach(() => jest.clearAllMocks());

describe('useItemAvailabilityNotice — nothing to say', () => {
  it('says nothing without a server verdict (older backend, or a bundle)', () => {
    setup();
    expect(notice(undefined)).toBeNull();
  });

  it('says nothing for an unrestricted item', () => {
    setup();
    expect(notice({ canOrder: true, reason: 'Available', allowedOrderTypes: ALL })).toBeNull();
  });

  it('says nothing while the admin-enabled channel list is still in flight — no chip it must retract', () => {
    setup({ loading: true });
    expect(notice(NOT_DINE_IN)).toBeNull();
  });

  it('says nothing for an Unavailable item — that is a manual toggle, and copy must not imply stock', () => {
    setup({ orderType: OrderType.DineIn });
    expect(notice({ canOrder: false, reason: 'Unavailable', allowedOrderTypes: [OrderType.Takeaway] })).toBeNull();
  });

  it('says nothing once a channel is chosen that CAN order the item — a chip there is noise', () => {
    setup({ orderType: OrderType.Takeaway });
    expect(notice(NOT_DINE_IN)).toBeNull();
  });
});

describe('useItemAvailabilityNotice — no channel chosen (the dominant browse state)', () => {
  it('chips where the item CAN be ordered, with no dimming and no CTA', () => {
    setup({ orderType: null });

    expect(notice(NOT_DINE_IN)).toEqual({
      tone: 'info',
      message: 'Takeaway and Delivery only',
      // Empty for an `info` notice: nothing is blocked, so there is no channel to name.
      shortMessage: '',
      switchTo: null,
      switchLabel: '',
      hint: null,
    });
  });
});

describe('useItemAvailabilityNotice — a channel is chosen and cannot order the item', () => {
  const blockedForDineIn: ItemAvailability = { ...NOT_DINE_IN, canOrder: false, reason: 'WrongOrderType' };

  it('dims and offers the first allowed channel as a one-tap switch', () => {
    setup({ orderType: OrderType.DineIn });

    expect(notice(blockedForDineIn)).toEqual({
      tone: 'blocked',
      message: 'Takeaway and Delivery only',
      // Names the channel the guest CHOSE, not the ones the dish allows — the phone's corner
      // marker has an 88px thumbnail to fit on and `message` is 34 characters in French.
      shortMessage: 'Not for Dine In',
      switchTo: OrderType.Takeaway,
      switchLabel: 'Switch to Takeaway',
      hint: null,
    });
  });

  it('suppresses the switch at a scanned table — the guest is sitting down, so point at a human', () => {
    setup({ orderType: OrderType.DineIn, hasTableContext: true });

    expect(notice(blockedForDineIn)).toEqual({
      tone: 'blocked',
      message: 'Takeaway and Delivery only',
      shortMessage: 'Not for Dine In',
      switchTo: null,
      switchLabel: '',
      hint: 'Ask your server',
    });
  });

  /**
   * The branch the pre-PR review asked for, and it is reachable rather than defensive.
   *
   * `shortMessage` normally names the channel the guest CHOSE ("Not for Dine-in") because the
   * phone's corner marker has an 88px thumbnail to fit on. That needs a chosen channel — and
   * `resolveChannelNotice` derives `blocked` from `canOrder` ALONE, with no guard on `orderType`
   * (`channelNotice.ts`: `const blocked = !canOrder`). So a server that refuses an item before the
   * guest has picked anything lands here with `tone: 'blocked'` and `orderType: null`.
   *
   * It falls back to the long form, NOT to `''`. An empty string is the dangerous answer: the
   * marker renders on tone alone, so it would paint a filled bar across the thumbnail saying
   * nothing. A sentence too long for a small box beats a wordless warning.
   */
  it('falls back to the long reason when the server blocks before a channel is chosen', () => {
    setup({ orderType: null });

    const result = notice(blockedForDineIn);
    expect(result?.tone).toBe('blocked');
    expect(result?.shortMessage).toBe('Takeaway and Delivery only');
    expect(result?.shortMessage).not.toBe('');
  });

  it('never offers a switch back to the channel already chosen', () => {
    setup({ orderType: OrderType.Takeaway });

    // Contrived but reachable: a stale card whose server verdict predates the switch.
    const stale: ItemAvailability = {
      canOrder: false,
      reason: 'WrongOrderType',
      allowedOrderTypes: [OrderType.Takeaway, OrderType.Delivery],
    };
    expect(notice(stale)?.switchTo).toBe(OrderType.Delivery);
  });
});

describe('useItemAvailabilityNotice — admin-disabled channels do not exist', () => {
  it('treats an item as unrestricted when the only channel it excludes is switched off anyway', () => {
    // Delivery disabled restaurant-wide; a Takeaway+Delivery item is then simply "takeaway", and
    // "Takeaway and Delivery only" would advertise a channel the guest cannot even pick.
    setup({ orderType: null, enabled: [OrderType.Takeaway] });

    expect(notice(NOT_DINE_IN)).toBeNull();
  });

  it('never offers a switch to a channel the admin disabled', () => {
    setup({ orderType: OrderType.DineIn, enabled: [OrderType.DineIn, OrderType.Delivery] });

    const blocked: ItemAvailability = { ...NOT_DINE_IN, canOrder: false, reason: 'WrongOrderType' };
    // Takeaway is allowed by the ITEM but disabled by the restaurant, so Delivery is the only offer.
    expect(notice(blocked)).toMatchObject({ switchTo: OrderType.Delivery, message: 'Delivery only' });
  });

  it('says NOTHING when every channel the item allows is disabled and no channel is chosen', () => {
    // The server said `canOrder` and a null-channel basket accepts the add, so dimming here would
    // be the client overruling the server — and §2 fixes that nothing dims before a channel is
    // picked. There is also no honest chip to draw: "Takeaway and Delivery only" would advertise
    // channels the guest cannot pick, and "Unavailable" would imply a sold-out item.
    setup({ orderType: null, enabled: [OrderType.DineIn] });

    expect(notice(NOT_DINE_IN)).toBeNull();
  });

  it('falls back to a plain unavailable line when the SERVER blocks and no channel can be offered', () => {
    setup({ orderType: OrderType.DineIn, enabled: [OrderType.DineIn] });

    expect(notice({ ...NOT_DINE_IN, canOrder: false, reason: 'WrongOrderType' })).toEqual({
      tone: 'blocked',
      message: 'Unavailable',
      shortMessage: 'Not for Dine In',
      switchTo: null,
      switchLabel: '',
      hint: null,
    });
  });
});

describe('useItemAvailabilityNotice — channel list ordering', () => {
  it('lists channels in declaration order regardless of the order the API returned them', () => {
    setup({ orderType: null, enabled: [OrderType.Delivery, OrderType.Takeaway, OrderType.DineIn] });

    expect(notice(NOT_DINE_IN)?.message).toBe('Takeaway and Delivery only');
  });
});

/**
 * The predicate the three item surfaces share. It exists because they had diverged: `FeaturedSpecial`
 * carried the `canOrder` clause and the two cards did not, so the same item dimmed in the hero and
 * stayed live in the grid directly below it.
 *
 * The clause matters because this hook returns `null` on purpose in two cases — `reason:
 * 'Unavailable'` and while the enabled-channel list loads — and a surface reading the notice ALONE
 * treats that null as "fine".
 */
describe('isItemBlocked', () => {
  const blockedNotice = {
    tone: 'blocked',
    message: 'Takeaway only',
    switchTo: null,
    switchLabel: '',
    shortMessage: 'Not for Dine-in',
    hint: null,
  } as const;
  const infoNotice = {
    tone: 'info',
    message: 'Takeaway only',
    shortMessage: '',
    switchTo: null,
    switchLabel: '',
    hint: null,
  } as const;

  it('blocks on the notice tone', () => {
    expect(isItemBlocked(undefined, blockedNotice)).toBe(true);
  });

  // THE regression. A server verdict of `canOrder: false` with no notice to show for it — the
  // `reason: 'Unavailable'` path — used to leave the card undimmed with a live "Add to order".
  it('blocks on the server verdict even when there is no notice to show', () => {
    expect(isItemBlocked({ canOrder: false } as ItemAvailability, null)).toBe(true);
  });

  it('does not block on an info notice', () => {
    expect(isItemBlocked({ canOrder: true } as ItemAvailability, infoNotice)).toBe(false);
  });

  it('does not block when there is no verdict and no notice', () => {
    // The dominant browse state: no channel chosen, nothing known, nothing dimmed.
    expect(isItemBlocked(undefined, null)).toBe(false);
  });

  it('does not block on a missing canOrder field', () => {
    // `undefined` is "the server did not say", which is not the same as "no". An older backend
    // must not dim the whole menu.
    expect(isItemBlocked({} as ItemAvailability, null)).toBe(false);
  });
});

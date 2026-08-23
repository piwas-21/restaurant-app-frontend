import { OrderType } from '@/types/order';
import {
  canSetChannel,
  categoryChannelStatus,
  closedForLabel,
  closedSentence,
  maskWithChannel,
  quickToggleSummary,
} from './categoryChannelStatus';

/** `t(key, fallback, vars)` — the interpolating stub every locale-free unit test here uses. */
const t = (_key: string, fallback: string, vars?: Record<string, string>) =>
  Object.entries(vars ?? {}).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, value), fallback);

const NOW = Date.parse('2026-08-22T12:15:00.000Z');

describe('categoryChannelStatus', () => {
  it('reports a null mask as unrestricted, with nothing closed and no age', () => {
    const status = categoryChannelStatus({ id: 'c1', availableOrderTypes: null }, 'Dürüm', NOW);

    expect(status.open).toEqual([OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery]);
    expect(status.closed).toEqual([]);
    // An open category has no closure to age, even when the row was edited a minute ago.
    expect(status.closedForMs).toBeNull();
  });

  it('splits a takeaway+delivery mask into open and closed channels', () => {
    const status = categoryChannelStatus({ id: 'c1', availableOrderTypes: 6 }, 'Dürüm', NOW);

    expect(status.open).toEqual([OrderType.Takeaway, OrderType.Delivery]);
    expect(status.closed).toEqual([OrderType.DineIn]);
  });

  it('ages a closure from the row timestamp', () => {
    const status = categoryChannelStatus(
      { id: 'c1', availableOrderTypes: 6, updatedAt: '2026-08-22T11:50:00.000Z' },
      'Dürüm',
      NOW,
    );

    expect(status.closedForMs).toBe(25 * 60_000);
  });

  it.each([
    ['absent', undefined],
    ['null', null],
    ['unparseable', 'not-a-date'],
    ['empty', ''],
  ])('reports no age when the timestamp is %s', (_label, updatedAt) => {
    const status = categoryChannelStatus({ id: 'c1', availableOrderTypes: 6, updatedAt }, 'Dürüm', NOW);
    expect(status.closedForMs).toBeNull();
  });

  it('reports no age when the device clock is BEHIND the server', () => {
    // The age is device-clock arithmetic against a server instant. A skewed till would otherwise
    // render "closed for -3 h", which is worse than saying nothing.
    const status = categoryChannelStatus(
      { id: 'c1', availableOrderTypes: 6, updatedAt: '2026-08-22T15:00:00.000Z' },
      'Dürüm',
      NOW,
    );

    expect(status.closedForMs).toBeNull();
  });
});

describe('canSetChannel', () => {
  it('always allows opening a channel', () => {
    expect(canSetChannel(0, OrderType.DineIn, true)).toBe(true);
  });

  it('allows closing a channel while another stays open', () => {
    expect(canSetChannel(null, OrderType.DineIn, false)).toBe(true);
  });

  it('refuses to close the LAST open channel', () => {
    // Mask 0 is rejected by the API and renders as a restriction with no stateable reason. The
    // admin matrix guards this with a disabled Save; a one-tap control has to refuse the tap.
    expect(canSetChannel(2, OrderType.Takeaway, false)).toBe(false);
  });
});

describe('maskWithChannel', () => {
  it('closes Dine-In on an unrestricted category', () => {
    expect(maskWithChannel(null, OrderType.DineIn, false)).toBe(6);
  });

  it('collapses a full set back to null, the category convention for unrestricted', () => {
    expect(maskWithChannel(6, OrderType.DineIn, true)).toBeNull();
  });

  it('leaves the other channels exactly as they were', () => {
    expect(maskWithChannel(2, OrderType.Delivery, true)).toBe(6);
  });
});

describe('closedForLabel', () => {
  it('says nothing below a minute, and nothing at all without an age', () => {
    expect(closedForLabel(null, t)).toBeNull();
    expect(closedForLabel(59_000, t)).toBeNull();
  });

  it('rounds down to minutes, hours and days', () => {
    expect(closedForLabel(25 * 60_000, t)).toBe('for 25 min');
    expect(closedForLabel(3 * 3_600_000 + 59 * 60_000, t)).toBe('for 3 h');
    expect(closedForLabel(2 * 86_400_000, t)).toBe('for 2 d');
  });
});

describe('the sentence the floor reads', () => {
  const durum = categoryChannelStatus(
    { id: 'c1', availableOrderTypes: 6, updatedAt: '2026-08-22T11:50:00.000Z' },
    'Dürüm',
    NOW,
  );
  const salads = categoryChannelStatus({ id: 'c2', availableOrderTypes: 3 }, 'Salads', NOW);
  const grills = categoryChannelStatus({ id: 'c3', availableOrderTypes: null }, 'Grills', NOW);

  it('names the CATEGORY, not just the channel', () => {
    // "Dine-In: off" is meaningless mid-service — this is the whole requirement.
    expect(closedSentence(durum, t, 'en')).toBe('Dürüm: closed to Dine In');
  });

  it('says every order type is available when nothing is closed', () => {
    expect(quickToggleSummary([grills], t, 'en')).toBe('All categories: every order type');
  });

  it('states one closure in full, with how long it has been in place', () => {
    expect(quickToggleSummary([grills, durum], t, 'en')).toBe('Dürüm: closed to Dine In · for 25 min');
  });

  it('omits the age when it cannot be stated', () => {
    const noStamp = categoryChannelStatus({ id: 'c1', availableOrderTypes: 6 }, 'Dürüm', NOW);
    expect(quickToggleSummary([noStamp], t, 'en')).toBe('Dürüm: closed to Dine In');
  });

  it('lists several restricted categories by NAME rather than counting them', () => {
    expect(quickToggleSummary([durum, salads, grills], t, 'en')).toBe('Dürüm, Salads: order types limited');
  });
});

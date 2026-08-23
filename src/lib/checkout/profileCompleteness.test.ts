/**
 * getProfileCompleteness / pickPreferredAddress — the decision the smart-skip
 * checkout rests on (`useSmartCheckoutRouter`), which had no unit test at all.
 *
 * What it decides is whether a logged-in diner is sent STRAIGHT to
 * /checkout/review with their profile copied into CheckoutContext, or is asked
 * for their details first. Getting it wrong in the permissive direction is
 * silent: the review page's guard only checks that `customerInfo` EXISTS, and
 * the backend's order validator checks items and tip — neither looks at whether
 * there is a name on the order. So the per-order-type floor below is the only
 * thing standing between a blank profile and an anonymous kitchen ticket, and
 * every branch of it is pinned here.
 *
 *   DineIn   name + email
 *   Takeaway name + email + phone
 *   Delivery name + email + phone + ≥1 saved address
 */
import { getProfileCompleteness, pickPreferredAddress, type MissingField } from './profileCompleteness';
import { OrderType } from '@/types/order';
import { UserRole, type UserDto } from '@/types/user';
import type { AddressDto } from '@/services/addressService';

const makeUser = (overrides: Partial<UserDto> = {}): UserDto => ({
  id: 'user-1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  fullName: 'Ada Lovelace',
  phoneNumber: '+41 79 000 00 00',
  role: UserRole.Customer,
  isEmailConfirmed: true,
  createdAt: '2026-01-01T00:00:00Z',
  isDeleted: false,
  metadata: {},
  orderLimitAmount: 0,
  discountPercentage: 0,
  isDiscountActive: false,
  ...overrides,
});

const makeAddress = (overrides: Partial<AddressDto> = {}): AddressDto => ({
  id: 'addr-1',
  userId: 'user-1',
  label: 'Home',
  addressLine1: 'Rue du Rhône 1',
  city: 'Genève',
  postalCode: '1204',
  country: 'CH',
  isDefault: false,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const ALL_TYPES = [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery] as const;
const PHONE_TYPES = [OrderType.Takeaway, OrderType.Delivery] as const;

/** What a complete profile has to be handed for each type — Delivery alone needs the list. */
const addressesFor = (orderType: OrderType): AddressDto[] | undefined =>
  orderType === OrderType.Delivery ? [makeAddress()] : undefined;

/** Both spellings of "there is nothing here" that `.trim()` has to catch. */
const BLANKS: ReadonlyArray<readonly [string, string]> = [
  ['empty', ''],
  ['whitespace-only', '   '],
];

/** [orderType, blank-label, blank-value] for every combination. */
const perTypeBlanks = (types: ReadonlyArray<OrderType>): Array<[OrderType, string, string]> =>
  types.flatMap((orderType) => BLANKS.map(([label, value]): [OrderType, string, string] => [orderType, label, value]));

describe('getProfileCompleteness — a profile that clears the floor', () => {
  it.each(ALL_TYPES)('%s: a full profile skips the contact step', (orderType) => {
    expect(getProfileCompleteness(makeUser(), orderType, addressesFor(orderType))).toEqual({
      complete: true,
      missing: [],
    });
  });

  it('DineIn asks for no phone number — the table is how the kitchen reaches you', () => {
    expect(getProfileCompleteness(makeUser({ phoneNumber: undefined }), OrderType.DineIn)).toEqual({
      complete: true,
      missing: [],
    });
  });

  it.each([OrderType.DineIn, OrderType.Takeaway])(
    '%s: an address list is irrelevant, even an empty one',
    (orderType) => {
      expect(getProfileCompleteness(makeUser(), orderType, []).complete).toBe(true);
    },
  );
});

describe('getProfileCompleteness — one missing field at a time', () => {
  it.each(perTypeBlanks(ALL_TYPES))('%s: a %s firstName is reported', (orderType, _label, blank) => {
    expect(getProfileCompleteness(makeUser({ firstName: blank }), orderType, addressesFor(orderType))).toEqual({
      complete: false,
      missing: ['firstName'],
    });
  });

  it.each(perTypeBlanks(ALL_TYPES))('%s: a %s lastName is reported', (orderType, _label, blank) => {
    expect(getProfileCompleteness(makeUser({ lastName: blank }), orderType, addressesFor(orderType))).toEqual({
      complete: false,
      missing: ['lastName'],
    });
  });

  // The confirmation mail is addressed to this. `checkoutContextSatisfies` in the
  // consuming hook refuses an empty email on the fast path, so smart-skip letting
  // one through was the same emptiness accepted one function away.
  it.each(perTypeBlanks(ALL_TYPES))('%s: a %s email is reported', (orderType, _label, blank) => {
    expect(getProfileCompleteness(makeUser({ email: blank }), orderType, addressesFor(orderType))).toEqual({
      complete: false,
      missing: ['email'],
    });
  });

  it.each(perTypeBlanks(PHONE_TYPES))('%s: a %s phoneNumber is reported', (orderType, _label, blank) => {
    expect(getProfileCompleteness(makeUser({ phoneNumber: blank }), orderType, addressesFor(orderType))).toEqual({
      complete: false,
      missing: ['phoneNumber'],
    });
  });

  it.each(PHONE_TYPES)('%s: an absent phoneNumber is reported too', (orderType) => {
    expect(getProfileCompleteness(makeUser({ phoneNumber: undefined }), orderType, addressesFor(orderType))).toEqual({
      complete: false,
      missing: ['phoneNumber'],
    });
  });
});

describe('getProfileCompleteness — Delivery needs somewhere to deliver', () => {
  it.each([
    ['the caller fetched no list', undefined],
    ['the list came back empty', [] as AddressDto[]],
  ])('%s → address is missing', (_label, addresses) => {
    expect(getProfileCompleteness(makeUser(), OrderType.Delivery, addresses)).toEqual({
      complete: false,
      missing: ['address'],
    });
  });

  it('one saved address is enough, default or not', () => {
    expect(getProfileCompleteness(makeUser(), OrderType.Delivery, [makeAddress({ isDefault: false })])).toEqual({
      complete: true,
      missing: [],
    });
  });
});

describe('getProfileCompleteness — everything missing at once', () => {
  const blankUser = makeUser({ firstName: '', lastName: '', email: '', phoneNumber: '' });

  it.each<[OrderType, MissingField[]]>([
    [OrderType.DineIn, ['firstName', 'lastName', 'email']],
    [OrderType.Takeaway, ['firstName', 'lastName', 'email', 'phoneNumber']],
    [OrderType.Delivery, ['firstName', 'lastName', 'email', 'phoneNumber', 'address']],
  ])('%s: reports every gap the type has, in canonical order', (orderType, expected) => {
    expect(getProfileCompleteness(blankUser, orderType)).toEqual({ complete: false, missing: expected });
  });

  // A blank-profile DineIn diner used to be waved through with `{ complete: true }`
  // and land on /checkout/review with an empty customer name.
  it('DineIn does not wave a nameless profile through', () => {
    expect(getProfileCompleteness(makeUser({ firstName: '', lastName: '' }), OrderType.DineIn).complete).toBe(false);
  });
});

describe('getProfileCompleteness — no user', () => {
  it.each<[OrderType, MissingField[]]>([
    [OrderType.DineIn, ['firstName', 'lastName', 'email']],
    [OrderType.Takeaway, ['firstName', 'lastName', 'email', 'phoneNumber']],
    [OrderType.Delivery, ['firstName', 'lastName', 'email', 'phoneNumber', 'address']],
  ])('%s: nobody logged in is nobody complete, and the gap list says what the type needs', (orderType, expected) => {
    expect(getProfileCompleteness(null, orderType)).toEqual({ complete: false, missing: expected });
  });

  it('Delivery: a saved address cannot rescue an absent user', () => {
    expect(getProfileCompleteness(null, OrderType.Delivery, [makeAddress()]).complete).toBe(false);
  });
});

describe('getProfileCompleteness — purity', () => {
  it('touches neither the user nor the address list', () => {
    const user = Object.freeze(makeUser({ firstName: '' }));
    const addresses = Object.freeze([makeAddress()]) as AddressDto[];

    expect(() => getProfileCompleteness(user, OrderType.Delivery, addresses)).not.toThrow();
    expect(user).toEqual(makeUser({ firstName: '' }));
    expect(addresses).toEqual([makeAddress()]);
  });

  it('hands each caller its own missing[] — never a shared array', () => {
    const first = getProfileCompleteness(makeUser({ firstName: '' }), OrderType.Takeaway);
    const second = getProfileCompleteness(makeUser({ firstName: '' }), OrderType.Takeaway);

    expect(first.missing).toEqual(second.missing);
    expect(first.missing).not.toBe(second.missing);
  });
});

describe('pickPreferredAddress', () => {
  it('returns null when there is nothing saved', () => {
    expect(pickPreferredAddress([])).toBeNull();
  });

  it('prefers the default address wherever it sits in the list', () => {
    const other = makeAddress({ id: 'addr-1' });
    const preferred = makeAddress({ id: 'addr-2', isDefault: true });

    expect(pickPreferredAddress([other, preferred])).toBe(preferred);
  });

  it('falls back to the first address when none is marked default', () => {
    const first = makeAddress({ id: 'addr-1' });
    const second = makeAddress({ id: 'addr-2' });

    expect(pickPreferredAddress([first, second])).toBe(first);
  });

  it('takes the first default when the API returns several', () => {
    const first = makeAddress({ id: 'addr-1', isDefault: true });
    const second = makeAddress({ id: 'addr-2', isDefault: true });

    expect(pickPreferredAddress([first, second])).toBe(first);
  });

  it('leaves the caller list untouched', () => {
    const addresses = [makeAddress({ id: 'addr-1' }), makeAddress({ id: 'addr-2', isDefault: true })];

    pickPreferredAddress(addresses);

    expect(addresses.map((a) => a.id)).toEqual(['addr-1', 'addr-2']);
  });
});

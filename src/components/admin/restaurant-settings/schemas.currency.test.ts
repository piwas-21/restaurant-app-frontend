import { restaurantInfoSchema } from './schemas';

const valid = {
  name: 'RUMI',
  addressLine1: 'Rue du Lac 1',
  city: 'Genève',
  postalCode: '1201',
  country: 'Switzerland',
  email: 'hello@rumirestaurant.ch',
};

describe('restaurantInfoSchema — currency', () => {
  it('accepts a 3-letter code and normalises it to upper-case', () => {
    const parsed = restaurantInfoSchema.parse({ ...valid, currency: 'chf' });
    expect(parsed.currency).toBe('CHF');
  });

  it('clears the field to null — undeclared is a state, never an empty string', () => {
    const parsed = restaurantInfoSchema.parse({ ...valid, currency: '' });
    expect(parsed.currency).toBeNull();
    expect(restaurantInfoSchema.parse({ ...valid, currency: null }).currency).toBeNull();
  });

  it('refuses anything that is not exactly three letters', () => {
    for (const bad of ['EURO', 'ch', '1234', 'CH F']) {
      const parsed = restaurantInfoSchema.safeParse({ ...valid, currency: bad });
      expect(parsed.success).toBe(false);
    }
  });
});

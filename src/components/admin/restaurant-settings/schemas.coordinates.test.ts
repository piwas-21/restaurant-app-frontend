import { restaurantInfoSchema } from './schemas';

/**
 * #716 — a cleared coordinate box stored 0, and 0,0 is a real place.
 *
 * The fixture is the WIRE shape: `RestaurantInfoDto.Latitude` / `.Longitude` are `double?`, and the
 * API sets no `DefaultIgnoreCondition`, so a restaurant without coordinates sends an explicit
 * `null`. `GeneralSettingsTab` seeds the form from that response verbatim.
 */
const valid = {
  name: 'RUMI',
  addressLine1: 'Rue de Berne 1',
  city: 'Genève',
  postalCode: '1201',
  country: 'Switzerland',
  email: 'contact@rumirestaurant.ch',
  addressLine2: null,
  website: null,
};

describe('restaurantInfoSchema coordinates (#716)', () => {
  /**
   * THE case. `.nullable()` short-circuits on `null` and never on `''`, so the empty string a
   * cleared `<input type="number">` produces reached `z.coerce.number()`, and `Number('')` is 0.
   *
   * Asserted on the VALUE and not on `success`: the broken schema parses `''` happily — it just
   * parses it to the wrong number, which is why no existing test caught this.
   */
  it('reads a cleared box as "no coordinate", not as 0', () => {
    const parsed = restaurantInfoSchema.parse({ ...valid, latitude: '', longitude: '' });

    expect(parsed.latitude).toBeNull();
    expect(parsed.longitude).toBeNull();
  });

  it('accepts the explicit null the API sends for a restaurant with no coordinates', () => {
    const parsed = restaurantInfoSchema.parse({ ...valid, latitude: null, longitude: null });

    expect(parsed.latitude).toBeNull();
    expect(parsed.longitude).toBeNull();
  });

  // The over-reach control: a real coordinate must still be a real coordinate, including the
  // legitimate 0 that a restaurant on the equator or the Greenwich meridian would have. The fix
  // must distinguish "the admin cleared the box" from "the admin typed 0" — Greenwich itself has
  // longitude 0, so a fix that mapped every 0 to null would be its own defect.
  it('keeps a coordinate that really is 0, typed on purpose', () => {
    const parsed = restaurantInfoSchema.parse({ ...valid, latitude: 51.4779, longitude: 0 });

    expect(parsed.latitude).toBe(51.4779);
    expect(parsed.longitude).toBe(0);
  });

  it('still reads an ordinary pair, and still refuses one out of range', () => {
    expect(restaurantInfoSchema.parse({ ...valid, latitude: 46.2044, longitude: 6.1432 })).toMatchObject({
      latitude: 46.2044,
      longitude: 6.1432,
    });
    expect(restaurantInfoSchema.safeParse({ ...valid, latitude: 91 }).success).toBe(false);
    expect(restaurantInfoSchema.safeParse({ ...valid, longitude: -181 }).success).toBe(false);
  });

  // The claim the old comment made about the OTHER optional field is true, and it is the positive
  // control for "this schema can handle an empty string when it says it does".
  it('still maps an empty website to null, as it always did', () => {
    expect(restaurantInfoSchema.parse({ ...valid, website: '' }).website).toBeNull();
  });
});

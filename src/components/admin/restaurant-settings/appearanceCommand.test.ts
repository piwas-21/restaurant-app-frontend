import { toUpdateCommand } from './appearanceCommand';
import type { RestaurantInfoDto } from '@/types/restaurantInfo';

const info: RestaurantInfoDto = {
  id: 'id-1',
  name: 'Rumi',
  addressLine1: 'Rue X 1',
  addressLine2: '2nd floor',
  city: 'Genève',
  postalCode: '1202',
  country: 'Switzerland',
  latitude: 46.2,
  longitude: 6.14,
  email: 'contact@rumirestaurant.ch',
  website: 'https://rumirestaurant.ch',
  themePaletteKey: 'olive-grove',
  entrancePositionX: 25,
  entrancePositionY: 75,
  phoneNumbers: [],
};

describe('toUpdateCommand (full-upsert guard, ADR-007)', () => {
  it('carries every current field so a palette save cannot wipe them', () => {
    expect(toUpdateCommand(info, 'saffron')).toEqual({
      name: 'Rumi',
      addressLine1: 'Rue X 1',
      addressLine2: '2nd floor',
      city: 'Genève',
      postalCode: '1202',
      country: 'Switzerland',
      latitude: 46.2,
      longitude: 6.14,
      email: 'contact@rumirestaurant.ch',
      website: 'https://rumirestaurant.ch',
      themePaletteKey: 'saffron',
      entrancePositionX: 25,
      entrancePositionY: 75,
    });
  });

  it('sends all 13 command fields (the full upsert, no more no less)', () => {
    expect(Object.keys(toUpdateCommand(info, 'saffron')).sort()).toEqual(
      [
        'addressLine1',
        'addressLine2',
        'city',
        'country',
        'email',
        'entrancePositionX',
        'entrancePositionY',
        'latitude',
        'longitude',
        'name',
        'postalCode',
        'themePaletteKey',
        'website',
      ].sort(),
    );
  });

  it('overrides only themePaletteKey, incl. clearing to null', () => {
    expect(toUpdateCommand(info, null).themePaletteKey).toBeNull();
    expect(toUpdateCommand(info, 'saffron').name).toBe(info.name);
    expect(toUpdateCommand(info, 'saffron').website).toBe(info.website);
    expect(toUpdateCommand(info, 'saffron').entrancePositionX).toBe(25);
  });

  it('normalises an absent entrance position (pre-backend contract) to null, never undefined', () => {
    const { entrancePositionX: _x, entrancePositionY: _y, ...rest } = info;
    const command = toUpdateCommand(rest, 'saffron');
    expect(command.entrancePositionX).toBeNull();
    expect(command.entrancePositionY).toBeNull();
  });
});

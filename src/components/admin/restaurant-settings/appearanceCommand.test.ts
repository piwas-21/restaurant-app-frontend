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
  logoUrl: 'https://rumirestaurant.ch/uploads/branding/logo.png',
  logoDarkUrl: null,
  interiorImageUrl: null,
  phoneNumbers: [],
  menuLayout: 'tabs',
  showMenuBundlesOnAllTab: false,
};

const menuDisplayTabs = { menuLayout: 'tabs', showBundlesOnAllTab: false } as const;
const menuDisplayOnePage = { menuLayout: 'onepage', showBundlesOnAllTab: true } as const;

describe('toUpdateCommand (full-upsert guard, ADR-007)', () => {
  it('carries every current field so a palette save cannot wipe them', () => {
    expect(toUpdateCommand(info, 'saffron', menuDisplayOnePage)).toEqual({
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
      menuLayout: 'onepage',
      showMenuBundlesOnAllTab: true,
    });
  });

  it('sends all 13 command fields (the full upsert, no more no less)', () => {
    expect(Object.keys(toUpdateCommand(info, 'saffron', menuDisplayOnePage)).sort()).toEqual(
      [
        'addressLine1',
        'addressLine2',
        'city',
        'country',
        'email',
        'latitude',
        'longitude',
        'menuLayout',
        'name',
        'postalCode',
        'showMenuBundlesOnAllTab',
        'themePaletteKey',
        'website',
      ].sort(),
    );
  });

  it('never sends the logo, so a palette save cannot clear it', () => {
    // The logo has its own endpoints (SOFRA-ONBOARDING-PLAN O6) precisely because this
    // command is a FULL upsert: the backend assigns every field it receives
    // unconditionally, so a logo carried here would be wiped by any writer that built the
    // command before the logo was uploaded. The fixture has a logo set — if these keys
    // ever appear, the wipe is already possible.
    const command = toUpdateCommand(info, 'saffron', menuDisplayOnePage);
    expect(command).not.toHaveProperty('logoUrl');
    expect(command).not.toHaveProperty('logoDarkUrl');
  });

  it('overrides only themePaletteKey, incl. clearing to null', () => {
    expect(toUpdateCommand(info, null, menuDisplayTabs).themePaletteKey).toBeNull();
    expect(toUpdateCommand(info, 'saffron', menuDisplayOnePage).name).toBe(info.name);
    expect(toUpdateCommand(info, 'saffron', menuDisplayOnePage).website).toBe(info.website);
    expect(toUpdateCommand(info, 'saffron', menuDisplayOnePage).city).toBe(info.city);
  });

  it('carries the menu-display settings so a palette save cannot reset them', () => {
    const command = toUpdateCommand(info, 'saffron', menuDisplayOnePage);
    expect(command.menuLayout).toBe('onepage');
    expect(command.showMenuBundlesOnAllTab).toBe(true);

    // And the tab's own defaults write the shipped behaviour back.
    const defaults = toUpdateCommand(info, null, menuDisplayTabs);
    expect(defaults.menuLayout).toBe('tabs');
    expect(defaults.showMenuBundlesOnAllTab).toBe(false);
  });
});

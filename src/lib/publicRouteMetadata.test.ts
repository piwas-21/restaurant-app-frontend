/** @jest-environment node */

import type { RestaurantInfoDto } from '@/types/restaurantInfo';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { restaurantJsonLd } from './publicRouteMetadata';

const restaurant: RestaurantInfoDto = {
  id: 'fixture',
  name: '</script><script>unsafe()</script>',
  addressLine1: '',
  addressLine2: null,
  city: '',
  postalCode: '',
  country: '',
  latitude: null,
  longitude: null,
  email: '',
  website: null,
  themePaletteKey: null,
  logoUrl: null,
  logoDarkUrl: null,
  interiorImageUrl: null,
  phoneNumbers: [],
  currency: 'CHF',
};

describe('restaurantJsonLd', () => {
  it('escapes script-closing markup while keeping valid JSON data', () => {
    const jsonLd = restaurantJsonLd(restaurant, [], 'en');

    expect(jsonLd).not.toBeNull();
    expect(jsonLd).toContain(String.raw`\u003c`);
    expect(JSON.parse(jsonLd ?? '{}').name).toBe(restaurant.name);

    const markup = renderToStaticMarkup(createElement('script', { type: 'application/ld+json' }, jsonLd));
    const scriptText = markup.match(/^<script type="application\/ld\+json">([\s\S]*)<\/script>$/)?.[1];
    expect(scriptText).toBe(jsonLd);
    expect(JSON.parse(scriptText ?? '{}').name).toBe(restaurant.name);
  });
});

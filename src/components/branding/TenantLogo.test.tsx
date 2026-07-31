import { render, screen } from '@testing-library/react';
import TenantLogo, { resolveLogoSrc } from './TenantLogo';
import type { RestaurantInfoDto } from '@/types/restaurantInfo';

const info = (overrides: Partial<RestaurantInfoDto> = {}): RestaurantInfoDto => ({
  id: 'id-1',
  name: 'Chez Amina',
  addressLine1: 'Rue X 1',
  addressLine2: null,
  city: 'Genève',
  postalCode: '1202',
  country: 'Switzerland',
  latitude: null,
  longitude: null,
  email: 'contact@example.test',
  website: null,
  themePaletteKey: null,
  logoUrl: null,
  logoDarkUrl: null,
  phoneNumbers: [],
  ...overrides,
});

const LIGHT = 'https://tenant.test/uploads/branding/light.png';
const DARK = 'https://tenant.test/uploads/branding/dark.png';

describe('resolveLogoSrc', () => {
  it('falls back to the light logo in dark mode when no dark variant exists', () => {
    // One logo that reads on both themes is the common case. Requiring two uploads before
    // showing anything would give a tenant with one logo a header whose identity changes
    // when the theme flips.
    expect(resolveLogoSrc(info({ logoUrl: LIGHT }), true)).toBe(LIGHT);
  });

  it('prefers the dark variant in dark mode when there is one', () => {
    expect(resolveLogoSrc(info({ logoUrl: LIGHT, logoDarkUrl: DARK }), true)).toBe(DARK);
  });

  it('never uses the dark variant in light mode when a light one exists', () => {
    expect(resolveLogoSrc(info({ logoUrl: LIGHT, logoDarkUrl: DARK }), false)).toBe(LIGHT);
  });

  it('uses the dark variant in light mode when it is the ONLY upload', () => {
    // The asymmetric version of this chain showed the mark on `/` and the name as text on
    // `/menu` for a dark-only tenant, at one theme setting in one browsing session:
    // `isDark` is not only the theme, since both classic chromes ask for the dark mark on
    // the home page (its hero is dark whatever the theme). Falling back in both
    // directions is what makes the header stable.
    expect(resolveLogoSrc(info({ logoDarkUrl: DARK }), false)).toBe(DARK);
    expect(resolveLogoSrc(info({ logoDarkUrl: DARK }), true)).toBe(DARK);
  });

  it('has no source at all for a tenant that uploaded nothing', () => {
    expect(resolveLogoSrc(info(), false)).toBeNull();
    expect(resolveLogoSrc(info(), true)).toBeNull();
  });

  it('has no source while restaurant info is still loading', () => {
    expect(resolveLogoSrc(null, false)).toBeNull();
  });

  it('treats an empty string as no logo', () => {
    // The backend normalises "" to null, but this is the failure that has no symptom
    // anywhere else: an empty string satisfies `??`, reaches <img src="">, and renders a
    // broken-image icon where the restaurant's name belongs.
    expect(resolveLogoSrc(info({ logoUrl: '' }), false)).toBeNull();
    expect(resolveLogoSrc(info({ logoUrl: LIGHT, logoDarkUrl: '' }), true)).toBe(LIGHT);
  });
});

describe('TenantLogo', () => {
  const renderLogo = (dto: RestaurantInfoDto | null, isDark = false) =>
    render(<TenantLogo info={dto} fallbackName="Fallback Co" isDark={isDark} width={180} height={90} />);

  it("renders the restaurant's name as text when there is no logo", () => {
    renderLogo(info());

    expect(screen.getByText('Chez Amina')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders the uploaded logo, labelled with the restaurant name', () => {
    renderLogo(info({ logoUrl: LIGHT }));

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', 'Chez Amina');
    expect(img.getAttribute('src')).toContain('light.png');
  });

  it('falls back to the build-time name only when the API gave us none', () => {
    // A tenant whose info has not loaded yet still shows something ownable rather than an
    // empty header — but the API name wins the moment it arrives.
    renderLogo(null);

    expect(screen.getByText('Fallback Co')).toBeInTheDocument();
  });
});

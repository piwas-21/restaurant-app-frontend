import { landingBackgroundUrl, landingOverridesFor } from './landingBackground';

describe('landingBackgroundUrl', () => {
  const custom = { backgroundMode: 'custom' as const, backgroundImageUrl: 'https://cdn.example/kebab-room.webp' };

  it('uses the restaurant upload when the mode is custom', () => {
    expect(landingBackgroundUrl(custom, '/branding/hero.png')).toBe('https://cdn.example/kebab-room.webp');
  });

  it.each([null, undefined, { backgroundMode: 'default' as const, backgroundImageUrl: null }])(
    'uses the platform artwork unless the admin chose custom or none',
    (landing) => {
      expect(landingBackgroundUrl(landing, '/branding/hero.png')).toBe('/branding/hero.png');
    },
  );

  it('answers null for none, so the section keeps its own background colour', () => {
    expect(landingBackgroundUrl({ backgroundMode: 'none', backgroundImageUrl: null }, '/branding/hero.png')).toBeNull();
  });

  it('does not render a vanished upload as an empty hero', () => {
    expect(landingBackgroundUrl({ backgroundMode: 'custom', backgroundImageUrl: null }, '/branding/hero.png')).toBe(
      '/branding/hero.png',
    );
  });
});

describe('landingOverridesFor', () => {
  const landing = {
    content: {
      en: { heroEyebrow: null, welcomeTitle: 'EN', welcomeBody: null, storyTitle: null, storyBody: null },
      pt: { heroEyebrow: null, welcomeTitle: 'PT', welcomeBody: null, storyTitle: null, storyBody: null },
    },
  };

  it('matches the exact language code first', () => {
    expect(landingOverridesFor(landing, 'pt')?.welcomeTitle).toBe('PT');
  });

  it('falls back to the base language for a regional code', () => {
    expect(landingOverridesFor(landing, 'pt-BR')?.welcomeTitle).toBe('PT');
  });

  it.each([null, undefined, 'de'])('answers null when no row covers the language (%s)', (language) => {
    expect(landingOverridesFor(landing, language)).toBeNull();
  });
});

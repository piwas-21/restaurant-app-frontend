// Curated colour palettes (ADR-007 Phase 1). Each shares an AA-verified warm
// "kitchen paper" neutral base (cream/ink surfaces + text, light + dark) and
// varies only the brand triad + link + on-primary text, so the neutral text/
// surface contrast is proven once and every preset stays WCAG-AA. The paired
// light + dark brands are chosen so cream-on-brand (buttons) and brand-on-cream
// (links/icons) both clear 4.5:1 — enforced by presets.test.ts.
//
// Raw hex is BY DESIGN here: this is a token-VALUE source (the ADR-007 counterpart
// of src/templates/*/tokens.css), not component styling — no component reads these
// literals; they only feed the CSS variables paletteToCss() emits. The S15
// "hex only in src/design-system/tokens/" rule targets component CSS, which this is not.
import type { Palette, PaletteVars } from './types';

// Shared neutral base — a palette varies the brand, not the paper.
const WARM_LIGHT = {
  'surface-primary': '#fff9f2', // warm cream paper
  'surface-secondary': '#eae0d2', // kraft
  'surface-secondary-light': '#f3ede1',
  'surface-card': '#fffcf8', // warm white plate
  'text-primary': '#3b2e26', // roasted-coffee ink (11:1 on cream)
  'text-secondary': '#5b5147', // warm taupe (7:1 on cream)
  'text-muted': '#746b5e', // 5:1 on cream
  'text-on-accent': '#fffcf8', // light text over the hero photo overlay
  'border-default': '#eae0d2',
  'border-light': '#f1eae0',
  'border-extra-light': '#f8f3ec',
} as const;

const WARM_DARK = {
  'surface-primary': '#211a16', // deep warm aubergine
  'surface-secondary': '#3e3630',
  'surface-secondary-light': '#4a403a',
  'surface-card': '#2c241f',
  'text-primary': '#f2e9dd', // warm cream (13:1 on aubergine)
  'text-secondary': '#cabfb0',
  'text-muted': '#a69885',
  'text-on-accent': '#fffcf8',
  'border-default': '#3e3630',
  'border-light': '#4a403a',
  'border-extra-light': '#4a403a',
} as const;

// A brand triad + its link + on-primary text, per mode.
interface BrandSet {
  primary: string;
  primaryDark: string;
  accent: string;
  link: string;
  linkHover: string;
  onPrimary: string;
}

function vars(base: typeof WARM_LIGHT | typeof WARM_DARK, b: BrandSet): PaletteVars {
  return {
    ...base,
    'brand-primary': b.primary,
    'brand-primary-dark': b.primaryDark,
    'brand-accent': b.accent,
    'link-default': b.link,
    'link-hover': b.linkHover,
    'text-on-primary': b.onPrimary,
  };
}

// Dark brands are light tints on the aubergine paper, so on-primary text is dark.
const CREAM = '#fff9f2';
const INK = '#211a16';

function warm(light: BrandSet, dark: BrandSet): Pick<Palette, 'light' | 'dark'> {
  return { light: vars(WARM_LIGHT, light), dark: vars(WARM_DARK, dark) };
}

export const PALETTES: readonly Palette[] = [
  {
    key: 'terracotta',
    labelKey: 'palette_terracotta',
    swatch: '#a84b2f',
    ...warm(
      {
        primary: '#a84b2f',
        primaryDark: '#7a3a24',
        accent: '#d9a441',
        link: '#a84b2f',
        linkHover: '#8f4128',
        onPrimary: CREAM,
      },
      {
        primary: '#f2b48c',
        primaryDark: '#d99b73',
        accent: '#e8c87c',
        link: '#f2b48c',
        linkHover: '#f7cbae',
        onPrimary: INK,
      },
    ),
  },
  {
    key: 'olive-grove',
    labelKey: 'palette_olive_grove',
    swatch: '#5a6139',
    ...warm(
      {
        primary: '#5a6139',
        primaryDark: '#474d2d',
        accent: '#9a7b2f',
        link: '#5a6139',
        linkHover: '#474d2d',
        onPrimary: CREAM,
      },
      {
        primary: '#b5bc8a',
        primaryDark: '#9aa072',
        accent: '#d8c98a',
        link: '#b5bc8a',
        linkHover: '#cbd0a6',
        onPrimary: INK,
      },
    ),
  },
  {
    key: 'saffron',
    labelKey: 'palette_saffron',
    swatch: '#96560f',
    ...warm(
      {
        primary: '#96560f',
        primaryDark: '#7a460c',
        accent: '#d9a441',
        link: '#96560f',
        linkHover: '#7a460c',
        onPrimary: CREAM,
      },
      {
        primary: '#e8c87c',
        primaryDark: '#d1b062',
        accent: '#f0d89a',
        link: '#e8c87c',
        linkHover: '#f0d89a',
        onPrimary: INK,
      },
    ),
  },
  {
    key: 'aubergine',
    labelKey: 'palette_aubergine',
    swatch: '#7a3b5a',
    ...warm(
      {
        primary: '#7a3b5a',
        primaryDark: '#632f49',
        accent: '#c98aa3',
        link: '#7a3b5a',
        linkHover: '#632f49',
        onPrimary: CREAM,
      },
      {
        primary: '#d8a3bf',
        primaryDark: '#c187a5',
        accent: '#e6c1d2',
        link: '#d8a3bf',
        linkHover: '#e6c1d2',
        onPrimary: INK,
      },
    ),
  },
  {
    key: 'rose-clay',
    labelKey: 'palette_rose_clay',
    swatch: '#a63f52',
    ...warm(
      {
        primary: '#a63f52',
        primaryDark: '#8a3444',
        accent: '#df9aa6',
        link: '#a63f52',
        linkHover: '#8a3444',
        onPrimary: CREAM,
      },
      {
        primary: '#e8a3ae',
        primaryDark: '#d1899a',
        accent: '#f0c1c9',
        link: '#e8a3ae',
        linkHover: '#f0c1c9',
        onPrimary: INK,
      },
    ),
  },
];

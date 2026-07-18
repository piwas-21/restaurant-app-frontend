---
name: Artisanal Kitchen
colors:
  surface: '#fff8f5'
  surface-dim: '#ecd6ca'
  surface-bright: '#fff8f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1ea'
  surface-container: '#ffeade'
  surface-container-high: '#fae4d8'
  surface-container-highest: '#f4ded2'
  on-surface: '#241912'
  on-surface-variant: '#56423d'
  inverse-surface: '#3b2e26'
  inverse-on-surface: '#ffede4'
  outline: '#89726c'
  outline-variant: '#dcc1b9'
  surface-tint: '#9d4327'
  primary: '#89341a'
  on-primary: '#ffffff'
  primary-container: '#a84b2f'
  on-primary-container: '#ffe0d8'
  inverse-primary: '#ffb59f'
  secondary: '#7d5700'
  on-secondary: '#ffffff'
  secondary-container: '#ffc55f'
  on-secondary-container: '#755100'
  tertiary: '#4c532c'
  on-tertiary: '#ffffff'
  tertiary-container: '#646b42'
  on-tertiary-container: '#e4ecb8'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbd1'
  primary-fixed-dim: '#ffb59f'
  on-primary-fixed: '#3b0a00'
  on-primary-fixed-variant: '#7e2c12'
  secondary-fixed: '#ffdeaa'
  secondary-fixed-dim: '#f5bd58'
  on-secondary-fixed: '#271900'
  on-secondary-fixed-variant: '#5f4100'
  tertiary-fixed: '#e0e7b4'
  tertiary-fixed-dim: '#c3cb9a'
  on-tertiary-fixed: '#181e01'
  on-tertiary-fixed-variant: '#434a24'
  background: '#fff8f5'
  on-background: '#241912'
  surface-variant: '#f4ded2'
typography:
  display-xl:
    fontFamily: Amatic SC
    fontSize: 96px
    fontWeight: '700'
    lineHeight: 100px
    letterSpacing: 2px
  display-md:
    fontFamily: Amatic SC
    fontSize: 64px
    fontWeight: '700'
    lineHeight: 72px
  headline-lg:
    fontFamily: Caveat
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 52px
  headline-md:
    fontFamily: Caveat
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 36px
  body-lg:
    fontFamily: Quicksand
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Quicksand
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 25.6px
  label-tape:
    fontFamily: Caveat
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 20px
  display-xl-mobile:
    fontFamily: Amatic SC
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 60px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  gutter: 20px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style
The design system is built on a "Handmade Craft" aesthetic, evoking the tactile feel of a letterpress specimen sheet or a handwritten chalkboard menu in a boutique bistro. It rejects digital perfection in favor of human imperfection, utilizing organic shapes and physical metaphors like masking tape and ink-pressed shadows.

The target audience consists of food enthusiasts who value provenance, craftsmanship, and the slow-food movement. The UI should feel warm, inviting, and slightly eclectic—like a well-loved kitchen scrapbook.

The style is a hybrid of **Brutalism** (raw, unrefined layouts and hard shadows) and **Organic Minimalism**. Key visual markers include:
- Solid flat pigments with zero gradients.
- "Wobbly" organic corners that mimic hand-cut paper or dough.
- Hard-edged, offset shadows that simulate physical depth without blurs.
- Slanted "masking tape" accents for labels and call-to-actions.

## Colors
The palette is inspired by natural ingredients and kitchen materials.

**Light Mode ("Warm Kitchen"):**
The foundation is a creamy parchment (#FFF9F2) with cards acting as "white plates" (#FFFCF8). Accents of Terracotta and Saffron provide warmth, while Olive and Roasted Coffee ensure legibility and a grounded, earthy feel.

**Dark Mode ("Late Evening"):**
The interface shifts to a moody, candle-lit atmosphere. The background transitions to a deep Aubergine (#211A16), with text softening to a Pale Olive and Apricot to maintain a high-contrast but "soft-on-the-eyes" reading experience for dinner service.

## Typography
The typography system uses a mix of tall, condensed display faces and intimate hand-written scripts.

- **Amatic SC** is reserved for large hero sections and category headers. It should always be uppercase to lean into its woodblock-print character.
- **Caveat** acts as the conversational layer. Use it for sub-headers, specific product names, and "Tape Labels." It adds the "chef's notes" personality to the UI.
- **Quicksand** provides a clean, modern, and highly readable foundation for descriptions, ingredients, and nutritional info.

Special Rule: **Dotted Menu-Leaders**
For menu listings, use a dotted leader style: `Item Name .................... $Price`. The dots should align to the baseline of the Quicksand body text.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a loose, scrapbook-like arrangement. Elements should not feel perfectly aligned to a robotic grid; slight offsets are encouraged.

- **Breakpoints:** Mobile (under 600px), Tablet (600px-1024px), Desktop (1025px+).
- **Margins:** Use wide 64px margins on desktop to allow the "parchment" background to frame the content. On mobile, tighten to 16px.
- **Eclectic Stacking:** Allow cards to slightly overlap or use varying vertical margins to create a rhythm that feels curated rather than generated.

## Elevation & Depth
Depth in this design system is achieved through physical displacement rather than light diffusion.

- **Hard-Edged Shadows:** Use `3px 3px 0px #3B2E26` (or the theme's text color) for all cards and primary buttons. This creates a "stamped" or "letterpress" look where the element appears physically lifted off the page.
- **Tonal Layers:** Use the "Kraft Panel" (#EAE0D2) as a mid-layer background for sidebars or "specials" sections to differentiate them from the main parchment background.
- **No Blurs:** Avoid `box-shadow` blurs or `backdrop-filter` blurs. All transitions between layers must be sharp.

## Shapes
The defining characteristic of this design system is the **Wobbly Corner**.

- **Containers & Cards:** Apply the complex border-radius `255px 15px 225px 15px / 15px 225px 15px 255px`. This creates a subtle, organic "hand-drawn" rectangle.
- **Tape Labels:** Small rectangular labels used for "Best Seller" or "Vegan" tags. These should be rotated exactly `-1.5deg` and use a standard sharp or slightly softened corner to look like torn masking tape.

## Components
Consistent application of the handmade aesthetic across all interactive elements:

- **Buttons:** Primary buttons use the Terracotta (#A84B2F) fill with the wobbly corner and the hard 3px shadow. Text should be white or the light background color. On hover, the shadow should disappear as if the button is being "pressed" into the paper.
- **Cards (Menu Items):** Background: #FFFCF8. Wobbly corners. Hard shadow. Use a 1px solid border in the "Roasted Coffee" color at 10% opacity to define edges on the cream background.
- **Input Fields:** Use a simple bottom-border (2px solid) rather than a full box, mimicking a lined notebook.
- **Lists:** Items separated by the dotted menu-leader. Prices should be bolded using Quicksand.
- **Tape Tags:** Small strips of Saffron (#D9A441) with Caveat text. Apply a `drop-shadow` that matches the 3px hard-edge style.
- **Checkboxes:** Hand-drawn appearance using a heavy 2px stroke. The "check" should be a simple "X" or a messy tick using the Primary color.

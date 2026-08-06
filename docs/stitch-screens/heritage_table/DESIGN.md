---
name: Heritage Table
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#5d3f3b'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#926f69'
  outline-variant: '#e7bdb6'
  surface-tint: '#c00000'
  primary: '#930000'
  on-primary: '#ffffff'
  primary-container: '#c00000'
  on-primary-container: '#ffcdc5'
  inverse-primary: '#ffb4a8'
  secondary: '#ac3231'
  on-secondary: '#ffffff'
  secondary-container: '#fd6d67'
  on-secondary-container: '#6d000c'
  tertiary: '#900b07'
  on-tertiary: '#ffffff'
  tertiary-container: '#b3281d'
  on-tertiary-container: '#ffccc5'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad4'
  primary-fixed-dim: '#ffb4a8'
  on-primary-fixed: '#410000'
  on-primary-fixed-variant: '#930000'
  secondary-fixed: '#ffdad7'
  secondary-fixed-dim: '#ffb3ae'
  on-secondary-fixed: '#410004'
  on-secondary-fixed-variant: '#8b191d'
  tertiary-fixed: '#ffdad5'
  tertiary-fixed-dim: '#ffb4a9'
  on-tertiary-fixed: '#410000'
  on-tertiary-fixed-variant: '#910b07'
  background: '#fcf9f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  section-heading:
    fontFamily: Playfair Display
    fontSize: 1.75rem
    fontWeight: '700'
    lineHeight: '1.3'
  dish-name:
    fontFamily: Playfair Display
    fontSize: 1.15rem
    fontWeight: '600'
    lineHeight: '1.4'
  body-main:
    fontFamily: Public Sans
    fontSize: 0.95rem
    fontWeight: '400'
    lineHeight: '1.55'
  price-tag:
    fontFamily: Public Sans
    fontSize: 1rem
    fontWeight: '600'
    lineHeight: '1'
  button-label:
    fontFamily: Public Sans
    fontSize: 0.95rem
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.02em
  label-muted:
    fontFamily: Public Sans
    fontSize: 0.8rem
    fontWeight: '400'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 0.5rem
  sm: 1rem
  md: 1.5rem
  lg: 2.5rem
  xl: 4rem
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  max-width: 1200px
---

## Brand & Style

The design system is built for a premium yet accessible restaurant ordering experience. It evokes the feeling of a crisp, physical menu found in a modern bistro—clean, confident, and warm. The aesthetic leans into **Corporate/Modern** with a **Tactile** edge through high-quality typography and subtle surface treatments.

The user should feel a sense of culinary authority and reliability. The interface uses heavy whitespace, deliberate serif headings for appetite appeal, and a strict "Ink and Paper" color philosophy. It avoids common app gimmicks in favor of a sturdy, timeless layout that treats food photography as the hero.

## Colors

This design system utilizes a restricted, high-impact palette. The **Primary Brand Red** is the sole driver of action; green for success or gold for premium features are strictly prohibited to maintain brand integrity.

- **Light Mode:** Focuses on a "Fresh Linen" look with #FFFFFF backgrounds and soft #F9F9F9 cards.
- **Dark Mode:** Titled "Dining Room at Night," it uses #1A1A1A to mimic a low-lit evening atmosphere. The primary red is "lifted" to #E06666 in dark mode to ensure AA accessibility against dark surfaces, with button text switching to dark for maximum legibility.
- **Ink Tones:** Text is never pure black, but a deep "Near-Black Ink" (#1A1A1A) to retain warmth.

## Typography

The typographic scale creates a "Literary Editorial" feel.
- **Headlines:** Use **Playfair Display**. This high-contrast serif adds an air of sophistication to dish names and category headers.
- **Body & Controls:** Use **Public Sans**. It provides a clean, neutral balance to the serif headlines, ensuring that functional information like preparation notes and ingredients are easy to scan.
- **Prices:** Must always use **Tabular Figures** (fixed-width numbers) to ensure that decimal points align perfectly in lists or carts, enhancing the professional "ledger" quality of the app.

## Layout & Spacing

The design system utilizes a **Fixed Grid** on desktop and a **Fluid Grid** on mobile devices.
- **Rhythm:** An 8px/4px base unit drives all padding and margins.
- **Desktop:** 12-column grid with a max-width of 1200px. Content is centered with generous outer margins to simulate a centered menu page.
- **Mobile:** 4-column grid with 16px side margins.
- **Structure:** Food categories are separated by large `lg` (40px) vertical gaps to prevent visual clutter. Card-to-card spacing within a category is a tighter `sm` (16px) to show grouping.

## Elevation & Depth

Depth is achieved through a combination of **Tonal Layers** and **Low-Contrast Outlines**.
- **The Hairline Rule:** All cards must feature a 1px solid border (#DDDDDD in light, #444444 in dark). This is a non-negotiable structural element that mimics printed menu containers.
- **Shadows:** Only one shadow level is permitted for cards: `0 1px 3px rgba(0,0,0,.06)`. This provides a subtle "lift" from the page without becoming a floating element.
- **Interactions:** Upon hover or press, the shadow does not grow; instead, the surface color shifts slightly to a secondary surface tone to indicate tactility.

## Shapes

The shape language is strictly controlled to maintain a "Modern Classic" look.
- **Corner Radius:** A universal **10px (rounded-lg)** radius is applied to all cards, buttons, input fields, and image containers.
- **Consistency:** Do not use "Pill" shapes for buttons or "Sharp" corners for images. The 10px radius creates a soft, approachable geometry that feels warmer than square corners but more professional than fully rounded bubbles.

## Components

- **Buttons:**
  - **Primary:** Solid #C00000 with #FFFFFF text. On press, shift to #890303.
  - **Secondary:** Transparent background with a 1px #C00000 border and #C00000 text.
- **Cards:** White or #F9F9F9 background, 10px radius, hairline #DDDDDD border. Food images should be top-aligned or left-aligned with no internal padding to the card edge, while text has a 16px internal margin.
- **Chips (Dietary Filters):** 1px border (#DDDDDD), 10px radius, using #6B7280 for text. If "Active," the border and text switch to Primary Red. No background fills for chips.
- **Input Fields:** 1px #DDDDDD border, 10px radius. Focus state uses a 1px #C00000 border with no outer glow.
- **Lists:** Use a simple 1px bottom border (#DDDDDD) between items. Avoid alternating row colors (zebra striping); use whitespace to separate items instead.
- **Cart Summary:** Stick to the "Secondary Surface" (#F0F0F0) to distinguish the order summary from the main browsing experience.

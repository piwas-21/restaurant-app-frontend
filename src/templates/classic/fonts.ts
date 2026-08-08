// classic template fonts (ADR-006).
//
// Playfair Display + Public Sans, per the generated design system
// (docs/stitch-screens/heritage_table/DESIGN.md §Typography, and the `fontFamily` block every
// generated screen's tailwind config carries):
//   - Playfair Display — dish names, section headings, category tabs, display. A high-contrast
//     serif; it is what makes the page read as a printed menu rather than a product catalogue.
//   - Public Sans     — body copy, prices, buttons, labels. Neutral counterweight to the serif.
//
// This replaces Inter, which was carried over verbatim from the root layout's original hardcoded
// load. Inter is the single biggest reason the implemented page did not resemble the designs: every
// dish name and heading rendered in a geometric sans where the design calls for a serif.
//
// Both are loaded as CSS VARIABLES rather than bare classNames. The root layout joins every font's
// `className` onto <body> (src/app/layout.tsx), so with `variable` set each font contributes its
// custom property and nothing else — leaving the two families addressable independently from CSS
// (`var(--font-display)` / `var(--font-body)`), which a className-only load cannot do. The body
// default is bound to --font-body in tokens.css.
import { Playfair_Display, Public_Sans } from 'next/font/google';

const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const fonts = [publicSans, playfairDisplay];

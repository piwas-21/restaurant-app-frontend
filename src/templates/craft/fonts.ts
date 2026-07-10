// craft template fonts (ADR-006, S15 T3 slice 1). Three families per
// SOFRA-TENANT-TEMPLATES-PLAN §3.3's perf budget (trim to 3 — no
// Kalam/Special Elite): Quicksand (body), Amatic SC (display/hero),
// Caveat (hand-written headings/accents).
//
// The v1 TemplateDefinition contract (../types.ts) has no CSS-variable
// mechanism — the root layout only joins font `className`s onto <body>
// (same as classic's single Inter font) — so HomePage.module.css /
// craft.module.css reference the loaded families directly by name
// (e.g. `font-family: 'Amatic SC', cursive`). next/font registers each
// font's @font-face as soon as any of these three classNames renders
// anywhere in the tree (which the root layout guarantees via <body>), so
// the literal family names are available globally without needing the
// class applied to every element that uses them.
//
// Arabic companions (Cairo body / Aref Ruqaa display) exist in the sofra
// marketing site's font stack for when `ar` is active — deliberately NOT
// loaded here (plan §3.3 "3 families max" for performance); revisit if a
// craft tenant needs full Arabic glyph coverage on the tenant app.
import { Quicksand, Amatic_SC, Caveat } from 'next/font/google';

const quicksand = Quicksand({ subsets: ['latin'] });
const amaticSC = Amatic_SC({ subsets: ['latin'], weight: ['400', '700'] });
const caveat = Caveat({ subsets: ['latin'] });

export const fonts = [quicksand, amaticSC, caveat];

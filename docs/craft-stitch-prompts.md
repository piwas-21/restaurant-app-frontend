# Sofra Craft Template — Google Stitch Design Prompts

> **Goal**: Design the craft tenant template's remaining surfaces (hero, header, menu, cart, checkout, reservations, auth) as generated Stitch screenshots **before** implementing them, so each surface is composed deliberately rather than hand-tweaked ad hoc. The craft design system already ships (`src/templates/craft/`); these prompts pin the generated designs to that exact palette + motif vocabulary so nothing drifts.
>
> **This is a prompts library, not an implementation.** Generate the designs in Stitch, save the screenshots, then translate each into components in follow-up PRs via the T4 per-surface slot mechanism (`src/templates/craft/surfaces.ts` + `resolve-surface.tsx`). Craft = the "made in a real kitchen" alternative to the `classic` RUMI look; it must feel hand-lettered and warm, never like a generic restaurant SaaS template.

---

## Research Synthesis — Why This Direction

### What the craft template is

The craft template mirrors the Sofra marketing site's "Pastel / Handmade" craft aesthetic onto a tenant restaurant app: warm cream paper, terracotta-clay ink, hand-lettered display type, letterpress shadows, organic (wobbly) border-radii, masking-tape section labels, and dotted menu-leaders — zero gradients anywhere. It's the visual opposite of the `classic` template (clean overlay hero, system-ish sans, uniform cards).

### What makes a restaurant site feel generic / "AI-generated" (avoid all of these)

- Inter / system-ui font stacks; a corporate all-sans hierarchy
- Blue or purple CTA buttons; blue-to-cyan gradients anywhere
- Uniform grid of identical rounded-rectangle cards with 1px gray borders and `shadow-md`
- A centered `max-w-2xl` hero with a stock food photo behind a purple gradient scrim
- Lucide/Heroicons used as decorative flourishes
- White background → slightly-off-white card → white background monotony
- Perfectly straight edges and perfectly uniform corner radii everywhere

### What we embrace (the craft vocabulary — already shipped, reuse it)

- **Colour**: solid, flat, pigment-like — terracotta clay, warm cream paper, olive, saffron; a "late-evening kitchen" aubergine/apricot dark mode that is a *different atmosphere*, not an inversion.
- **Type**: hand-lettered display (Amatic SC), flowing handwriting for accents/headings (Caveat), a rounded friendly body face (Quicksand). Three families max (perf budget).
- **Motifs**: flat **letterpress** shadow (`3px 3px 0`) with a hover-lift / active-press; **organic radius** (`255px 15px 225px 15px / 15px 225px 15px 255px`); **masking-tape** section labels (irregular clip-path, tilted ~-1.5°); **dotted menu-leaders** (`name ····· price`). Slight, deliberate rotations (±1–2°) so things look placed by hand.
- **Whitespace is texture** — generous, breathing sections.

---

## How to Use

1. Open [stitch.withgoogle.com](https://stitch.withgoogle.com).
2. Paste **Prompt 1 (the design system) first** so the palette + type + motifs are in context, then paste **one section prompt at a time**.
3. Save the generated design screenshot into `docs/stitch-screens/` (one subfolder per prompt; keep the light + dark pair).
4. Tick the row in the **Progress Tracker** when done.

> **Re-skin, not re-flow.** For data surfaces (menu, cart, checkout, reservations, auth) keep the existing information architecture and **all four UI states — loading, empty, error, success**. Stitch is generating a *look* for structure that already exists, not a new flow.

---

## Prompt 1 — Craft Design System: pigment palette, hand-lettered type, letterpress motifs

```
Design a design system for a restaurant ordering app using a warm, handmade,
letterpress "craft" aesthetic. It must feel like a small family kitchen hand-
lettered its own menu board — NOT a restaurant SaaS template. Think: kraft
paper, a rubber-stamp price list, a chalk-and-terracotta trattoria. Zero
gradients anywhere; every colour is solid and flat like a pigment.

COLOUR PALETTE — solid flat colours only, NO gradients:
- Light theme ("warm kitchen at noon"):
  Background: warm cream paper (#FFF9F2)
  Card surface: warm white plate (#FFFCF8)
  Secondary surface / kraft panel: kraft paper (#EAE0D2)
  Text: roasted-coffee ink (#3B2E26), never pure black
  Secondary text: olive (#5A6139)
  Muted text: warm taupe (#746B5E)
  Primary accent: terracotta clay (#A84B2F) — solid, flat; hover/pressed (#7A3A24)
  Secondary accent: saffron threads (#D9A441)
  Borders / dividers: kraft (#EAE0D2), thin and soft
  Danger/destructive: brick (#B44F46)
  Text on terracotta buttons: cream (#FFF9F2)

- Dark theme ("late-evening kitchen" — a different atmosphere, NOT an invert):
  Background: deep warm aubergine (#211A16), like a dim kitchen, not black
  Card surface: warm charcoal plate (#2C241F)
  Secondary surface: dark umber (#3E3630)
  Text: warm cream (#F2E9DD)
  Secondary text: pale olive (#B5BC8A)
  Primary accent: luminous apricot (#F2B48C) — glows softly on the aubergine
  Secondary accent: pale saffron (#E8C87C)
  Borders: dark umber (#3E3630)
  Danger: soft terracotta glow (#E8948C); text on apricot buttons is dark (#211A16)

TYPOGRAPHY — hand-lettered forward, NO Inter, NO system fonts (three families only):
- Display / hero headline: "Amatic SC Bold" — rough, bold, hand-painted; huge
  sizes 4rem–6rem, tight leading (1.05).
- Headings / accents / tape labels: "Caveat" — flowing handwriting, warm; 1.25rem–3rem.
- Body / UI / prices: "Quicksand" — rounded friendly geometric sans, very readable
  at small sizes but soft, never corporate; 1rem, 1.6 leading.

SPACING: generous — sections breathe. Whitespace is texture, not emptiness.

MOTIFS / TEXTURES (render as flat CSS effects, no gradients):
- LETTERPRESS shadow: a hard-edged flat offset shadow (3px 3px 0 in the kraft
  border colour) under cards and buttons; on hover the element lifts up-left
  (shadow grows to 5px 5px 0); on press it sinks (1px 1px 0). No soft blur.
- ORGANIC RADIUS: corners are wobbly, NOT uniform — like a torn/whittled edge
  (border-radius 255px 15px 225px 15px / 15px 225px 15px 255px).
- MASKING-TAPE label: a small section label that looks like a torn strip of
  masking tape stuck on at a slight angle (~-1.5° rotation, irregular edges,
  kraft-coloured, Caveat font) — used above section headings.
- DOTTED MENU-LEADER: a row where a name on the left and a price on the right are
  joined by a row of dots (name ····· price), like an old printed menu.
- Slight hand-placed rotations (±1–2°) on cards and labels.

Generate light and dark theme swatches side by side, showing:
- Background / card / kraft-panel surfaces
- Text hierarchy (Amatic SC Bold display, Caveat heading, Quicksand body)
- Primary (terracotta / apricot), secondary (saffron) accent blocks — solid, flat
- A sample card showing the letterpress offset shadow + organic wobbly radius
- A masking-tape label and a dotted menu-leader row
- Danger/destructive swatch

Make it look like a letterpress print shop's type-and-ink specimen sheet.
```

---

## Prompt 2 — Home Hero: full-bleed photo, craft text overlaid (replaces the half/half split)

```
Design the HOME hero for the craft restaurant app. Craft aesthetic (Prompt 1):
warm kitchen, hand-lettered type, letterpress motifs, zero gradients.

LAYOUT — the background photo must FILL THE SCREEN (this replaces an older
half-image / half-text-card split — do NOT split the hero into two columns):
- A single full-bleed, full-viewport-height food photograph is the hero
  background (edge to edge, cover). The craft header sits above it (see Prompt 3);
  the hero fills the remaining viewport height below that header.
- A warm, subtle darkening overlay sits on top of the photo ONLY for text
  contrast — a flat warm-charcoal wash at ~30% (NOT a gradient), just enough
  that hand-lettered text stays legible on any photo.
- The hero content is CENTERED over the photo:
  - A masking-tape label at the top: a torn kraft-tape strip tilted ~-1.5°,
    Caveat font, reading a short category line ("Authentic Turkish Cuisine").
  - H1 headline in Amatic SC Bold, ~4.5rem, cream, with a soft text-shadow so it
    reads on the photo ("Discover Authentic Turkish Flavors").
  - A one-line subhead in Caveat, ~1.5rem, warm cream.
  - Two call-to-action buttons in a row:
    - PRIMARY "View Menu": a solid terracotta letterpress pill (flat 3px offset
      shadow, organic wobbly radius, Amatic SC / Caveat label, a simple hand-drawn
      fork-and-knife mark — line art, not Lucide).
    - SECONDARY "Book a Table": an OUTLINE pill with a light cream border and cream
      text (so it stays visible ON the photo), same wobbly radius, letterpress feel.

VISUAL DETAILS:
- No opaque text card floating over half the hero — the text sits directly on the
  darkened photo, letterpress buttons and tape label providing the craft texture.
- Keep the craft character: tape label, Amatic SC display, Caveat accents,
  letterpress CTAs — just full-bleed instead of a side card.

Generate light and dark versions stacked vertically. In dark mode the overlay is a
deeper warm-charcoal wash and the primary CTA is luminous apricot with dark text.
```

---

## Prompt 3 — Main Header: hand-lettered wordmark, no redundant reservation button

```
Design the sticky top HEADER/navbar for the craft restaurant app. Craft aesthetic
(Prompt 1). It is an opaque in-flow sticky bar (NOT a transparent overlay).

LAYOUT — a single horizontal bar on a warm-white plate surface with a flat
letterpress bottom edge (a hard 3px kraft-coloured shadow, no blur):
- LEFT: the restaurant wordmark in Amatic SC Bold, ~2.3rem, ink-brown, tilted
  ~-2° like a hand-painted sign; it links home.
- RIGHT: the navigation — the SHARED role-based nav links (e.g. Menu,
  Reservations, My Orders) rendered as text links that get an organic wobbly-radius
  pill on hover/active; then a language switcher, a light/dark theme switcher, and
  either a user avatar menu or a "Login" link.

IMPORTANT — do NOT add a separate "Make a Reservation" / "Book a Table" button in
the header. "Reservations" is ALREADY one of the nav links, and the home hero
already has a "Book a Table" CTA, so a header reservation button would be the third
copy of the same action. The header's nav links + switchers + login/avatar are the
complete set. (This prompt intentionally shows the header WITHOUT that button.)

MOBILE: the nav collapses behind a hand-drawn hamburger; tapping slides in a right-
hand panel on the warm-white plate with the same links stacked, each divided by a
dotted rule (like the menu-leader dots), and the switchers at the bottom.

Generate light and dark versions. In dark mode the bar is the aubergine card
surface with a cream wordmark and an apricot hover pill.
```

---

## Prompt 4 — Menu Page: the hand-lettered menu board

```
Design the MENU page for the craft restaurant app. Craft aesthetic (Prompt 1).
Re-skin the existing menu structure — keep category navigation and item cards;
preserve loading, empty, error, and populated states.

LAYOUT — a hand-kept menu board:
- Category filters as masking-tape tabs across the top: each category is a torn
  kraft-tape strip, slightly tilted at different small angles, Caveat font; the
  active one is terracotta-tinted.
- Menu items as letterpress cards on the cream page: warm-white plate surface,
  organic wobbly radius, flat 3px offset shadow, each card tilted a hair (±1°)
  so the grid looks hand-placed, not a rigid CSS grid.
- Each item card: a photo with a wobbly-radius mask; the dish name in Amatic SC
  (~1.75rem, ink); a short description in Quicksand (muted); the price as a Caveat
  price tag; an "Add" action as a small terracotta letterpress pill with a simple
  hand-drawn plus mark. Bundle/combo items get a small kraft "combo" tape badge.
- STATES: loading = kraft skeleton plates with a soft pulse; empty category = a
  hand-drawn empty-plate illustration + a Caveat "nothing here yet" line.

VISUAL DETAILS: dotted menu-leaders may connect a name to its price where a row
layout reads better than a card. Zero gradients; warm shadows only.

Generate light and dark versions. In dark mode cards are the aubergine card
surface with cream lettering and an apricot "Add" pill.
```

---

## Prompt 5 — Cart / Basket: a kitchen order pad

```
Design the CART / basket for the craft restaurant app. Craft aesthetic (Prompt 1).
Re-skin the existing cart — keep line items, quantity steppers, totals, and the
empty-cart state.

LAYOUT — a paper order pad / kitchen docket:
- The cart panel looks like a torn-off order pad sheet: warm-white plate, organic
  wobbly radius, letterpress shadow, a faint ruled-line texture behind the items.
- Each line item is a menu-leader row: dish name (Amatic SC) on the left, a
  hand-drawn quantity stepper in the middle (minus / number / plus as small kraft
  letterpress buttons), and the line price (Caveat) on the right, joined by dots.
- Item customizations (extras / removals) appear as small handwritten Caveat notes
  indented under the item, like a server's scribbles.
- TOTALS block at the bottom on a kraft panel: subtotal / fees / total as menu-
  leader rows, the grand total in Amatic SC Bold terracotta.
- Primary "Checkout" as a wide terracotta letterpress pill; "keep browsing" as a
  quiet outline pill.
- EMPTY STATE: a hand-drawn empty pot/plate illustration + a Caveat "your order
  pad is empty" line + a terracotta "Browse the menu" pill.

Generate light and dark versions.
```

---

## Prompt 6 — Checkout: an honest, hand-written bill

```
Design the CHECKOUT for the craft restaurant app. Craft aesthetic (Prompt 1).
Re-skin the existing checkout flow — keep the order-type / address / contact /
payment steps and the order summary; preserve validation-error and success states.

LAYOUT — a two-column composition on the cream page (stacks on mobile):
- LEFT: the form, grouped into clearly labelled sections, each introduced by a
  masking-tape label (Caveat). Inputs look like fields on craft paper: warm-white
  fill, a slightly irregular kraft underline/border (thicker on the bottom edge
  like a brush stroke), Quicksand text, Caveat placeholder hints. Radio/segmented
  choices (e.g. delivery vs pickup) are letterpress paper-tab toggles.
- RIGHT: a sticky order summary styled as a hand-written bill/receipt: line items
  as dotted menu-leaders, a kraft totals panel, the total in Amatic SC Bold
  terracotta, and a small "all-inclusive" reassurance note in Caveat.
- The place-order button is a wide terracotta letterpress pill ("Place order").

STATES: field errors show as a soft-brick handwritten note under the field (Caveat),
never a harsh red box; a submitting state presses the button in (active letterpress);
success is a hand-drawn stamped "order received" seal.

Generate light and dark versions.
```

---

## Prompt 7 — Reservations: a table booking on a reservation card

```
Design the RESERVATIONS page for the craft restaurant app. Craft aesthetic
(Prompt 1). Re-skin the existing booking form + "my reservations" list; preserve
loading, empty, error, and confirmed states.

LAYOUT:
- The booking form is a single letterpress reservation card (warm-white plate,
  wobbly radius, offset shadow), introduced by a masking-tape "Book a Table" label.
  Party-size, date, and time are hand-drawn steppers / a craft-styled calendar &
  time chips (letterpress pills, the selected one terracotta). Name / phone / notes
  are craft-paper inputs (as in checkout). A wide terracotta "Reserve" pill submits.
- Below (for signed-in guests): "Your reservations" as a small stack of docket
  cards, each with the date/time in Amatic SC, party size, and a status as a
  handwritten Caveat badge (confirmed / pending / cancelled — use the palette's
  state colours, soft not harsh).
- EMPTY: a hand-drawn empty-table illustration + a Caveat "no bookings yet" line.

Generate light and dark versions.
```

---

## Prompt 8 — Auth: login / register on a warm welcome card

```
Design the LOGIN and REGISTER screens for the craft restaurant app. Craft aesthetic
(Prompt 1). Re-skin the existing auth forms; preserve validation-error and loading
states and the social-login options.

LAYOUT — a single centred welcome card on the cream page (letterpress plate, wobbly
radius, offset shadow), with a large warm food photo or hand-drawn illustration to
one side on wide screens:
- A masking-tape label ("Welcome back" / "Join us") above an Amatic SC heading.
- Craft-paper inputs (warm-white fill, irregular kraft underline, Quicksand text,
  Caveat placeholders). A wide terracotta letterpress "Sign in" / "Create account"
  pill.
- Social sign-in (Google / Apple) as outline letterpress pills with simple hand-
  drawn marks; a dotted "or" divider (menu-leader dots) between them and the form.
- A Caveat link to switch between login and register.
- ERRORS as soft-brick handwritten notes, never harsh red boxes.

Generate both login and register, light and dark.
```

---

## Progress Tracker

| # | Surface | Status | Screenshot(s) |
|---|---|---|---|
| 1 | Design system (palette / type / motifs) | ✅ Generated (reference) | Prompt-1 specimen generated; the craft design system already ships in `src/templates/craft/` |
| 2 | Home hero (full-bleed) | ✅ Implemented (#228) | Prompt 2 (light + dark generated); craft baselines in `__screenshots__/craft/` |
| 3 | Main header (no redundant reservation CTA) | ✅ Implemented (#228) | Prompt 3 (desktop light/dark + mobile generated) |
| 4 | Menu page | 🔨 Tabs shipped (#229); heading + states next | Prompt 4 (light + dark generated) |
| 5 | Cart / basket | ☐ To generate | — |
| 6 | Checkout | ☐ To generate | — |
| 7 | Reservations | ☐ To generate | — |
| 8 | Auth (login / register) | ☐ To generate | — |

> After a design is generated and saved, change ☐ → ✅ and link the screenshot folder. When a surface is implemented, note its PR (e.g. `✅ Implemented (#NNN)`), mirroring the domainio tracker's prompt→design→PR loop.

---

## Design Principles

**What we're avoiding (the generic-restaurant-site / AI-template tells):**

- Inter / system-ui type; an all-sans corporate hierarchy
- Blue or purple CTAs; any gradient (hero scrims, buttons, dividers)
- A rigid grid of identical cards with 1px gray borders and soft `shadow-md`
- A centred `max-w` hero with a stock photo behind a purple gradient
- Lucide/Heroicons as decoration; perfectly uniform corners and edges everywhere

**What we're embracing:**

- Solid pigment colours (terracotta / cream / olive / saffron; aubergine/apricot dark)
- Hand-lettered display (Amatic SC) + handwriting accents (Caveat) + rounded body (Quicksand)
- Flat letterpress shadows, organic wobbly radii, masking-tape labels, dotted menu-leaders
- Slight hand-placed rotations; whitespace as texture; zero gradients
- Re-skin, not re-flow — the same IA + all four data states, dressed in craft

> These map 1:1 onto the shipped craft primitives in `src/templates/craft/` — `craft.module.css` (`.letterpress`, `.roundedCraft`, `.tapeLabel`, `.menuLeader`), `tokens.css` (the exact palette above), and `fonts.ts` (Amatic SC / Caveat / Quicksand). Implement each generated design against those, via the per-surface slot mechanism, so nothing drifts from the design system.
```

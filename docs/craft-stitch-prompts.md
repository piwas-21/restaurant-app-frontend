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

- **Colour**: solid, flat, pigment-like — terracotta clay, warm cream paper, olive, saffron; a "late-evening kitchen" aubergine/apricot dark mode that is a _different atmosphere_, not an inversion.
- **Type**: hand-lettered display (Amatic SC), flowing handwriting for accents/headings (Caveat), a rounded friendly body face (Quicksand). Three families max (perf budget).
- **Motifs**: flat **letterpress** shadow (`3px 3px 0`) with a hover-lift / active-press; **organic radius** (`255px 15px 225px 15px / 15px 225px 15px 255px`); **masking-tape** section labels (irregular clip-path, tilted ~-1.5°); **dotted menu-leaders** (`name ····· price`). Slight, deliberate rotations (±1–2°) so things look placed by hand.
- **Whitespace is texture** — generous, breathing sections.

---

## How to Use

1. Open [stitch.withgoogle.com](https://stitch.withgoogle.com).
2. Paste **Prompt 1 (the design system) first** so the palette + type + motifs are in context, then paste **one section prompt at a time**.
3. Save the generated design screenshot into `docs/stitch-screens/` (one subfolder per prompt; keep the light + dark pair).
4. Tick the row in the **Progress Tracker** when done.

> **Re-skin, not re-flow.** For data surfaces (menu, cart, checkout, reservations, auth) keep the existing information architecture and **all four UI states — loading, empty, error, success**. Stitch is generating a _look_ for structure that already exists, not a new flow.

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

## Prompt 7 — Reservations: a hand-drawn seating chart + booking docket

> **Revised 2026-07-22.** The original prompt (and the old `reservations_light/dark_mode`
> screens) assumed a form-only page with an inline "my reservations" list. The real
> `/reservations` page is a **two-column floor-plan booking screen** — an interactive visual
> table map + a booking panel — and "my reservations" is its own page (`/my-reservations`).
> **Regenerated 2026-07-22** from the prompts below (7a desktop · 7b tablet/mobile ·
> 7c my-reservations) — screens committed under `reservations_*_{desktop,tablet,mobile}/`
> and `my_reservations_*/`; the old form-only `reservations_light_mode/` /
> `reservations_dark_mode/` dirs are superseded (kept as historical record).

### Prompt 7a — Reservations page, desktop / wide

```
Design the RESERVATIONS page for the craft restaurant app, DESKTOP width
(~1280px). Craft aesthetic (Prompt 1). This is a two-column screen: an
interactive restaurant floor plan on the left, a booking panel on the right.
Re-skin the existing structure; preserve loading, empty, error, and success
states. Do NOT invent a step wizard.

LEFT — THE FLOOR PLAN (the centrepiece):
- A large kraft-paper panel styled like a hand-drawn seating chart pinned to the
  wall: wobbly organic border, letterpress offset shadow, a masking-tape
  "Choose your table" label stuck on top at a slight angle, and a small
  hand-drawn compass/door mark for the entrance.
- Tables are ONLY circles, squares, and rectangles (no rotated shapes), drawn
  like rubber-stamped shapes on the paper, each with its table number in
  Amatic SC and a tiny seat-count. Sizes vary with capacity (a 2-seat round is
  visibly smaller than an 8-seat rectangle) and tables never touch — generous
  hand-placed spacing.
- Availability states, soft not harsh: AVAILABLE = olive-inked outline stamp;
  SELECTED = solid terracotta fill with cream number (like a wax-crayon
  fill-in), slight lift; BOOKED = faded kraft stamp with a small handwritten
  "taken" note, clearly non-interactive. Multiple tables can be selected.
- A hand-drawn legend row under the chart (three stamped swatches + Caveat
  labels). NO floating popups over the map — details of a clicked table appear
  in the booking panel, not on the chart.
- When the party is too big for any single table: a soft saffron sticky-note
  banner suggesting combining tables (not a red alert).

RIGHT — THE BOOKING DOCKET (a letterpress reservation card):
- Masking-tape "Book a table" label, then in order:
  1. PARTY SIZE: stamped number pills 1–8 (selected = terracotta) + a small
     hand-drawn "more" stepper for larger groups.
  2. DATE: a horizontal strip of the next days as small tear-off calendar
     leaves (selected leaf terracotta).
  3. TIME: letterpress time chips; unavailable ones faded; loading state =
     softly pulsing blank chips.
  4. YOUR TABLES: a small docket listing each selected table (number, seats,
     indoor/outdoor, any table note) as handwritten ticket lines — this
     replaces the map popup; includes a "combine tables" checkbox chip when
     2+ tables are selected.
  5. GUEST DETAILS: craft-paper inputs (name, email, phone optional, special
     requests textarea), as in checkout.
  6. A wide terracotta letterpress "Book Now" pill.
- ERRORS as soft-brick handwritten notes under the field, never harsh red.

Generate light and dark versions.
```

### Prompt 7b — Reservations page, tablet + mobile

```
Design the same craft RESERVATIONS page (Prompt 7a) at TABLET (~768px) and
MOBILE (~390px) widths. Same content, single-column stacked: title → floor
plan → booking docket.

- The floor plan keeps its EXACT aspect ratio (6:5) at every width — it scales
  down as one piece, tables shrink proportionally with it and never overlap or
  spill outside the paper. Never crop it or squash it vertically.
- On mobile the chart is still comfortably tappable: table stamps keep a
  minimum finger-size touch target; the legend wraps to two lines.
- The booking docket goes full-width below the chart; date leaves and time
  chips become horizontally swipeable strips; the "Book Now" pill stays
  full-width and thumb-reachable.
- Show the selected-tables docket collapsed to a compact one-line ticket per
  table on mobile.

Generate tablet and mobile, light and dark.
```

### Prompt 7c — My Reservations: a stack of docket cards

```
Design the MY RESERVATIONS page for the craft restaurant app. Craft aesthetic
(Prompt 1). Re-skin the existing list; preserve loading, empty, and error
states.

- Masking-tape "Your reservations" label above an Amatic SC heading.
- Each reservation is a docket card (warm-white plate, wobbly radius, offset
  shadow, slight alternating tilt): date + time big in Amatic SC, party size
  and table number as Quicksand ticket lines, and the status as a handwritten
  Caveat badge — pending (saffron), confirmed (olive), cancelled (soft kraft),
  completed (muted), no-show (soft brick). Soft, stamped — never traffic-light
  pills.
- Cards expand to show restaurant notes / special requests as a handwritten
  footnote. Pending/confirmed cards get a quiet "Cancel" outline pill.
- EMPTY: a hand-drawn empty-table illustration + a Caveat "no bookings yet"
  line and a terracotta "Book a table" pill.

Generate light and dark versions.
```

> **Implementation notes (ride the Prompt 7 PRs — behaviour fixes + decided deviations, not just re-skin).**
> Audited + corrected 2026-07-23 (adversarial code verify); owner decisions 2026-07-23: table details in
> the DOCKET (no map popup), ONE uniform table icon (shape system removed end-to-end, adapt the generated
> stamps in implementation — no regeneration), entrance position becomes backend data, field required-ness
> becomes admin-configurable (workspace `docs/plans/RESERVATIONS-REVAMP-PLAN.md`).
>
> 1. **Kill the map popup.** `VisualTableLayout` sets `activeTooltipTableId` on every non-booked
>    click (so it also fires on *deselect*) and the tooltip visually covers neighbouring tables
>    (it is `pointer-events: none`, so it hides rather than blocks — same UX damage). Remove it;
>    per-table details (seats, indoor/outdoor, notes) move to the booking-panel "Your Tables"
>    docket — `SelectedTableInfo` already receives full `TableDto`s and renders only the numbers.
> 2. **One table icon — shapes removed end-to-end.** Replace the circle/square/rectangle stamp
>    system with a single hand-drawn table icon + table number + seat count. Delete the per-shape
>    size matrices and the admin shape picker; stop sending `shape`/`width`/`height`; backend
>    drops those columns (with `rotation`) in one migration.
> 3. **Admin↔customer position parity.** The real bug is the ANCHOR MISMATCH: the admin canvas
>    centres tables on (x,y) via `translate(-50%,-50%)`, the customer map anchors them top-left —
>    every table renders shifted by half its size for customers. (The floor plan's 2rem padding is
>    NOT a cause — absolute children resolve % against the padding box.) Fix: one shared
>    canvas-geometry module (the 600×500 constant is defined in 3 frontend files + the backend
>    seeder comment), the same centre anchor in both renderers, aspect-ratio preserved at every
>    breakpoint (scale, don't re-flow — today ≤768/640/480px swap 6:5 for fixed 350/300/240px
>    heights, vertically distorting positions).
> 4. **Remove rotation entirely.** Delete `useTableRotation`, the ↻ handle in `TableCanvas`,
>    `rotate()` transforms in both renderers, `persistRotation` in `useTableLayoutMutations`, and
>    the `rotation` field from save payloads. Backend `Rotation` isn't validator-required and
>    `UpdateTableCommand` assigns it unconditionally, so omitting it zeroes stored values — the
>    desired outcome; the column is dropped with the shape columns. Bonus: the admin-canvas bug
>    where an inline `rotate()` REPLACES the centring translate (rotated tables jump by half
>    their size) disappears with the feature.
> 5. **Entrance marker becomes backend data.** Today the admin editor saves the entrance position
>    to the ADMIN's own browser localStorage and the customer map reads the CUSTOMER's — real
>    customers always see the default {50,10}. Add entrance-position fields to RestaurantInfo
>    (backend), write from the admin editor, read on the customer map; delete the localStorage
>    mechanism (`useTableEntrance`).
> 6. **Delete dead code.** `ReservationWizard.tsx` (396 LOC) + `ReservationWizard.module.css` +
>    `src/app/styles/Reservations.module.css` have zero importers. No jest coverage rows reference
>    them (the covered-file-deletion trap does NOT apply here), but all three are in
>    `scripts/file-length-baseline.txt` — regen the baseline in the same PR. Sweep wizard-only
>    i18n keys.
> 7. **CSS consolidation.** `ReservationsPage.module.css`: 6 breakpoints, the whole 600px block
>    redundant, `.layout`/`.bookingPanel` defined 7× each. `VisualTableLayout.module.css`: size
>    matrix declared 5× (goes away with note 2), dead `.tableLabel`/`.entranceDoor`/`.entranceLabel`
>    rules, selected glow blue at base but gold at ≤640/480px. Root cause of the dead label rules:
>    the JSX renders `styles.tableNumber`, which the module never defines — the table number is
>    completely unstyled today; fix the name, don't just delete rules. Rebuild both on a small
>    breakpoint set (e.g. 1024/768/480) with fluid sizing between, and tokenize the raw
>    rgba()/blue/gold literals while touching them (the no-inline-hex gate will flag them).
> 8. **BaseModal migration** of `CancelReservationModal` / `CancelSuccessModal` /
>    `ReservationSuccessModal` (hand-rolled overlays) so they inherit the craft shell —
>    already noted in the Prompt 12 row; do it in this PR.
> 9. **Time chips: show unavailable slots struck-through/disabled** (as the generated mobile
>    design does) instead of silently filtering them out — the unfiltered list is already
>    client-side (`getFilteredTimeSlots`). Drop the unreachable booked-table "available at HH:mm"
>    toast path while there.
> 10. **My-reservations fixes (with the 7c re-skin):** the status pill compares the numeric enum
>    against label strings so it never gets a colour class (hidden by `reservation: any`) — type
>    it and use the `StatusBadge` primitive; `formatDate` hardcodes `en-US` — use the active
>    i18next locale; drop the "Modify" `alert()` stub (feature doesn't exist); give the empty
>    state the designed illustration + "Book a table" CTA.
> 11. **A11y:** floor-plan tables are `<div onClick>` — make them real buttons (role, tabIndex,
>    keyboard activation) and label the map for screen readers (sibling of the closed #217 fixes).
> 12. **Form fields:** guest-details required-ness (phone today: HTML-`required` but
>    logic-optional) is resolved by the admin-configurable form-fields module — the reservation
>    form consumes its config; until it ships, align on optional phone (drop the HTML `required`).

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

## Modals & overlays (the missed layer)

The eight prompts above cover every _page_, but nothing that _overlays_ a page. The craft template's surface mechanism (T4) only re-skins non-modal surfaces, so **every modal, sheet, and dialog still renders through the shared, un-skinned `BaseModal` chrome** — uniform 16px corners, a soft blurred `shadow-md`, no Amatic title, no masking-tape, no letterpress. That is why the item **Details / customisation sheet** (and every other overlay) looks off in craft even though the page behind it is fully skinned.

**Prompt 9 (the modal shell) is the foundation — like Prompt 1 is for pages.** Generate it first; the other modal prompts build on it. Implementation note (for whoever wires these up): make Prompt 9 a craft `BaseModal` treatment (a craft surface for the shell) so all seven `BaseModal`-based customer modals inherit it at once — the content prompts then only dress what's _inside_ each.

## Prompt 9 — Modal / dialog shell: a note pinned to the table

```
Design the MODAL / DIALOG SHELL for the craft restaurant app — the shared chrome
EVERY overlay uses (item details, table/address/contact forms, confirmations, image
lightbox). Craft aesthetic (Prompt 1). This is the FRAME, not the contents.

LAYOUT — a card/docket laid on the cream page, not a floating glass panel:
- BACKDROP: a warm, semi-opaque INK wash over the page (never a cold black or a
  heavy blur); a faint paper grain is fine. Zero gradients.
- PANEL: a warm-white plate with the organic wobbly radius and a FLAT letterpress
  offset shadow (never a soft blurred shadow-md), a 2px kraft border, and optionally
  a hair of rotation (≤0.5°) so it reads hand-placed — like a torn card set on the
  table. Centred on desktop; on mobile a bottom-SHEET slid up from the bottom edge
  with a small kraft "pull" tab.
- HEADER: the title in Amatic SC (ink), optionally on a masking-tape strip; a
  hand-drawn close "✕" top-right (a scribbled kraft mark, not a lucide icon).
- BODY: Quicksand text; whitespace used as texture.
- FOOTER: actions right-aligned — primary as a terracotta letterpress pill,
  secondary ("Cancel") as a quiet kraft outline pill.

Generate light and dark versions (dark = aubergine panel, cream lettering, apricot
primary pill, warm-ink backdrop).
```

---

## Prompt 10 — Item details / customisation sheet: a recipe card

```
Design the ITEM DETAILS / CUSTOMISATION sheet for the craft restaurant app — the
overlay that opens from a menu card's "Details" and when customising an item. Craft
aesthetic (Prompt 1); it sits inside the modal shell (Prompt 9). Re-skin the existing
content — keep the photo, name, price, description, allergens, the variation/size
picker, add/remove ingredients, side items, a quantity stepper, a special-requests
note field, and the add-to-order total CTA. Preserve every state.

LAYOUT — an item "recipe card":
- A large photo with a wobbly-radius mask at the top (or left on wide screens); the
  dish name in Amatic SC, the price as a Caveat price tag, description in Quicksand,
  allergens as small kraft tag chips WITH their icons.
- VARIATIONS / SIZES as letterpress paper-tab toggles (selected = terracotta).
- INGREDIENTS to add/remove as a checklist of small kraft letterpress chips — ticked
  = terracotta with a hand-drawn check, a "+price" in Caveat where it adds cost;
  a removal reads like a struck-through handwritten note.
- SIDE ITEMS as the same chip pattern under a masking-tape "Sides" label.
- SPECIAL REQUESTS as a craft-paper textarea (warm fill, irregular kraft underline,
  Caveat placeholder "add a note for the kitchen…").
- QUANTITY as a hand-drawn stepper (kraft − / number / + letterpress buttons).
- FOOTER CTA: a wide terracotta letterpress pill "Add to order · <total>", the live
  total in Amatic SC.
- STATES: a required-choice-missing hint as a soft-brick Caveat note (never a red
  box); a bundle/combo variant lists its included items as a small dotted menu-leader.

Generate light and dark versions.
```

---

## Prompt 11 — Order-flow form modals: table / delivery / contact

```
Design the THREE short ORDER-FLOW modals for the craft restaurant app — inside the
modal shell (Prompt 9), craft aesthetic (Prompt 1). Re-skin the existing forms;
preserve validation-error and submitting states. All three share the shell and the
craft-paper input styling from checkout (Prompt 6).

1. TABLE SELECTION ("Select your table"): a hand-drawn table-number picker — kraft
   letterpress number chips laid out like a little floor plan, the chosen one
   terracotta — plus guest name/email craft-paper inputs beneath.
2. DELIVERY ADDRESS ("Where should we deliver?"): craft-paper inputs for street /
   city / postcode / country / notes under a masking-tape label; guest
   name/email/phone below.
3. TAKEAWAY / EDIT CONTACT ("Almost there — your details" / "Edit your details"):
   name / email / phone craft-paper inputs only, with the optional guest "create an
   account" opt-in as a small kraft-tape checkbox note.

Also include the ORDER-TYPE editor: the Dine In / Takeaway / Delivery choice as
letterpress paper-tab toggles (the active one terracotta) — the "Edit order details"
overlay.

Each: an Amatic SC title, craft-paper fields, a terracotta letterpress "Confirm" pill
+ a quiet "Cancel" outline pill; field errors as soft-brick Caveat notes.

Generate light and dark versions.
```

---

## Prompt 12 — Outcome dialogs: seals, confirms, results

```
Design the OUTCOME dialogs for the craft restaurant app — inside the modal shell
(Prompt 9), craft aesthetic (Prompt 1). Short confirm / success overlays; re-skin the
existing ones.

1. ORDER RECEIVED (post-checkout): a hand-drawn stamped "order received" wax-seal
   motif, the order number in Amatic SC, a Caveat "we've emailed your receipt" line,
   and a terracotta "Back to menu" pill.
2. RESERVATION booked / cancelled: the same seal treatment — a warm "table booked"
   confirmation and a soft "reservation cancelled" note (kraft, not harsh).
3. GENERIC CONFIRM ("are you sure?" — cancel reservation, remove item, refund): an
   Amatic title, a Quicksand body line, a terracotta primary + kraft-outline
   secondary; destructive actions use the palette's soft-brick, never a harsh red.
4. RESULT (success / error): a small hand-drawn tick or a soft-brick cross + a Caveat
   message.

Generate light and dark versions.
```

---

## Prompt 13 — Image lightbox: a matted print

```
Design the IMAGE LIGHTBOX for the craft restaurant app — opens when a menu photo is
tapped to view it larger. Photo-first, but on the modal shell's warm-ink backdrop
(Prompt 9). Craft aesthetic (Prompt 1).

LAYOUT: the enlarged photo matted like a print on a warm-white plate with a
wobbly-radius mask and a flat letterpress shadow; the dish name on a small
masking-tape caption. Prev / next as hand-drawn arrow marks (kraft letterpress round
buttons), a counter ("2 / 4") in Caveat, and the hand-drawn "✕" close. Single-image
items show no arrows.

Generate light and dark versions.
```

---

## Progress Tracker

| #   | Surface                                                    | Status                                              | Screenshot(s)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Design system (palette / type / motifs)                    | ✅ Generated (reference)                            | [`stitch_the_craft_kitchen_specimen/`](stitch-screens/stitch_the_craft_kitchen_specimen/); the system already ships in `src/templates/craft/`                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2   | Home hero (full-bleed)                                     | ✅ Implemented (#228)                               | [`home_hero_light_mode/`](stitch-screens/home_hero_light_mode/) · [`_dark_mode/`](stitch-screens/home_hero_dark_mode/)                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 3   | Main header (no redundant reservation CTA)                 | ✅ Implemented (#228)                               | [`header_light_mode_desktop/`](stitch-screens/header_light_mode_desktop/) · [`_dark_mode_desktop/`](stitch-screens/header_dark_mode_desktop/) · [`_light_mode_mobile/`](stitch-screens/header_light_mode_mobile/)                                                                                                                                                                                                                                                                                                                                                      |
| 4   | Menu page                                                  | ✅ Implemented (#229 tabs · #231 heading/states)    | [`menu_light_mode/`](stitch-screens/menu_light_mode/) · [`_dark_mode/`](stitch-screens/menu_dark_mode/)                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 5   | Cart / basket                                              | ✅ Implemented (#233)                               | [`cart_light_mode_desktop/`](stitch-screens/cart_light_mode_desktop/) · [`_dark_mode_desktop/`](stitch-screens/cart_dark_mode_desktop/)                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 6   | Checkout                                                   | ✅ Implemented (#254 shell+bill · #258 payment/tip) | [`checkout_light_mode_desktop/`](stitch-screens/checkout_light_mode_desktop/) · [`_dark_mode_desktop/`](stitch-screens/checkout_dark_mode_desktop/)                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 7   | Reservations (7a desktop · 7b tablet/mobile · 7c my-reservations) | 🎨 Designs generated 2026-07-22 — to implement per the implementation notes in the Prompt 7 section above (decided deviations 2026-07-23: uniform table icon replaces shaped stamps; docket, no popup) | 7a/7b: [`reservations_light_mode_desktop/`](stitch-screens/reservations_light_mode_desktop/) · [`_dark_mode_desktop/`](stitch-screens/reservations_dark_mode_desktop/) · [`_light_mode_tablet/`](stitch-screens/reservations_light_mode_tablet/) · [`_dark_mode_tablet/`](stitch-screens/reservations_dark_mode_tablet/) · [`_light_mode_mobile/`](stitch-screens/reservations_light_mode_mobile/) · [`_dark_mode_mobile/`](stitch-screens/reservations_dark_mode_mobile/); 7c: [`my_reservations_light_mode_desktop/`](stitch-screens/my_reservations_light_mode_desktop/) · [`_dark_mode_desktop/`](stitch-screens/my_reservations_dark_mode_desktop/). Old form-only `reservations_light/dark_mode` superseded. |
| 8   | Auth (login / register)                                    | ✅ Implemented (#252)                               | login [`_light`](stitch-screens/login_light_mode_desktop/) · [`_dark`](stitch-screens/login_dark_mode_desktop/) · register [`_light`](stitch-screens/register_light_mode_desktop/) · [`_dark`](stitch-screens/register_dark_mode_desktop/)                                                                                                                                                                                                                                                                                                                             |
| 9   | Modal / dialog shell (BaseModal chrome)                    | ✅ Implemented (#259)                               | `BaseModal` chrome re-skinned via `--modal-*` tokens (radius/shadow/border/rules/Amatic title) — hits all ~11 modals at once. [`_light`](stitch-screens/modal_shell_light_mode/) · [`_dark`](stitch-screens/modal_shell_dark_mode/)                                                                                                                                                                                                                                                                                                                                    |
| 10  | Item details / customisation sheet                         | ✅ Implemented (#261, body polish via tokens)       | `ItemCustomizationSheet` — the "Details / customise" overlay. [`_light`](stitch-screens/item_details_light_mode/) · [`_dark`](stitch-screens/item_details_dark_mode/)                                                                                                                                                                                                                                                                                                                                                                                                  |
| 11  | Order-flow modals (table / address / contact / order-type) | ✅ Implemented (#261, body polish via tokens)       | `TableSelectionModal`, `DeliveryAddressModal`, `TakeawayInfoModal`, `EditOrderTypeModal` — [order-type `_light`](stitch-screens/order_type_light_mode/)·[`_dark`](stitch-screens/order_type_dark_mode/), [contact `_light`](stitch-screens/contact_details_light_mode/)·[`_dark`](stitch-screens/contact_details_dark_mode/), [address `_light`](stitch-screens/delivery_address_light_mode/)·[`_dark`](stitch-screens/delivery_address_dark_mode/), [table `_light`](stitch-screens/table_selection_light_mode/)·[`_dark`](stitch-screens/table_selection_dark_mode/) |
| 12  | Outcome dialogs (confirm / success / result)               | 🔨 Order-received seal shipped (#261); reservation dialogs ride the Prompt 7 PR (BaseModal migration); admin Confirmation/Result untemplated | `OrderConfirmationModal`, reservation `Cancel*` / `*Success`, `ConfirmationModal`, `ResultModal` — [order-received `_light`](stitch-screens/order_received_light_mode/)·[`_dark`](stitch-screens/order_received_dark_mode/), [confirm-dialog `_light`](stitch-screens/confirmation_dialog_light_mode/)·[`_dark`](stitch-screens/confirmation_dialog_dark_mode/), [reservation-status `_light`](stitch-screens/reservation_status_light_mode/)·[`_dark`](stitch-screens/reservation_status_dark_mode/)                                                                  |
| 13  | Image lightbox                                             | ✅ Implemented (#261, matted print via tokens)      | `ImageGalleryModal`. [`_light`](stitch-screens/image_lightbox_light_mode/) · [`_dark`](stitch-screens/image_lightbox_dark_mode/)                                                                                                                                                                                                                                                                                                                                                                                                                                       |

> Saved design PNGs are **downscaled to ≤1200px** (≤1000KB, the `check-added-large-files` limit) — reference resolution, not pixel-perfect. Stitch's raw `code.html` exports are omitted (generated clutter; the screenshots are the record). Regenerate full-res from the prompt if needed.

> After a design is generated and saved, change ☐ → ✅ and link the screenshot folder. When a surface is implemented, note its PR (e.g. `✅ Implemented (#NNN)`), mirroring the domainio tracker's prompt→design→PR loop.

> **Beyond the numbered prompts:** a hand-drawn **kitchen wallpaper** (owner-generated, light + dark) now sits behind every craft page — `✅ Implemented (#256)` via a `--page-canvas` token + `public/craft/` tiles. Per-modal _body_ polish (Prompts 10–13) shipped in one PR (#261) riding on the #259 shell — item-details recipe card, order-flow craft-paper inputs, order-received wax seal, matted lightbox — via `--modal-body-*` tokens with per-site classic-literal `var()` fallbacks (classic computed-identical). **Still to do:** reservations (Prompt 7), including the reservation dialogs deferred from Prompt 12 (they're hand-rolled overlays, not `BaseModal` — migrate them to `BaseModal` in that PR so they inherit the shell, then seal-style them).

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

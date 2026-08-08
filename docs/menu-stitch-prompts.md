# Menu Page Redesign — Google Stitch Prompts (classic + craft)

> **Goal**: redesign the public menu page (`/menu`) as generated Stitch screens **before** implementing,
> for **both** shipped templates (`classic`, `craft`), in **light + dark**, at **three breakpoints**.
> Companion to [`craft-stitch-prompts.md`](craft-stitch-prompts.md), which covers the craft template's
> other surfaces — this file is menu-specific and is the only prompt doc that also covers **classic**.
>
> **This is a prompts library, not an implementation.** Generate in Stitch, save the screens under
> [`stitch-screens/`](stitch-screens/) (one subfolder per prompt, light + dark pair), then translate
> each into components in follow-up PRs. Craft surfaces go through the T4 slot mechanism
> (`src/templates/craft/surfaces.ts` + `resolve-surface.tsx`); classic edits the shared components.

---

## Triage — what belongs in Stitch, and what does not

The four reported issues are not the same kind of problem. Two are design work; one is a code bug
Stitch cannot help with; one is already fixed and released.

| #   | Reported                                                                           | Verdict                                              | Where it goes           |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------- |
| 1a  | "Edit-price button's design doesn't look nice… including its edit mode in classic" | **Design** — genuine                                 | **Prompt 5**            |
| 1b  | "Some menu items don't have edit-price button when logged in as admin"             | **Already fixed and in prod** — see below            | nothing to do           |
| 2   | "Chef's Special doesn't look nice / doesn't fit classic / takes too much space"    | **Design** — genuine, and the root cause is nameable | **Prompts 3, 4**        |
| 3   | "Add order and details buttons take too much space"                                | **Design** — genuine, and worse than reported        | **Prompts 1, 2**        |
| 4   | "Categories nav bar has empty space on top in mobile when scrolling"               | **Not a design issue — a one-line CSS bug**          | fix directly, see below |

### 1b — the missing edit-price button is already fixed

It was diagnosed and fixed on 2026-08-02 in
[`fix(menu): say why the price cannot be edited instead of rendering nothing (#369)`](../../frontend)
(`2c200d1`), and that commit is an ancestor of both `main` and the released prod frontend `606aa30`
(released 2026-08-05) — I verified both with `git merge-base --is-ancestor`.

What was happening: [`AdminPriceEditor`](../src/components/menu/AdminPriceEditor.tsx) returned `null`
for combos and for variation products, so the button was simply absent on some cards with nothing to
distinguish that from a defect. Combos had no `priceEditability` verdict at all
([`catalogItem.ts:64`](../src/utils/catalogItem.ts)), which read as `undefined`.

Today those cards render a **locked pill** instead — a lock glyph plus the reason
("A combo's price comes from the items in it" / "Price is set per variation").

**So if you are still seeing "no button", you are almost certainly looking at that locked pill** — and
that is a fair complaint, just a different one: it is a low-contrast grey pill with no border and no
control affordance, so it reads as _absence_ rather than as _refusal_. **Prompt 5 designs all three
states** (rest, editing, locked) so the locked one is legible as a deliberate state.

### 4 — the category-nav gap is a CSS bug, not a layout to redesign

Root cause, confirmed in the source. [`CategoryNav.module.css`](../src/components/menu/CategoryNav.module.css)
hardcodes the sticky offset at both mobile breakpoints:

```css
@media (max-width: 768px) {
  .stickyNav {
    top: 130px; /* 80px header + 50px TableBanner */
  }
}
@media (max-width: 480px) {
  .stickyNav {
    top: 130px; /* 80px header + 50px TableBanner */
  }
}
```

But [`TableBanner`](../src/components/TableBanner.tsx) returns `null` when there is no table context:

```tsx
if (!hasTableContext) {
  return null;
}
```

The banner only renders for a guest who arrived by scanning a table QR. **For everyone else the 50px
it would have occupied is still reserved**, so the sticky nav parks 50px below the header and you get
exactly the empty strip you described, on every normal mobile visit.

Stitch cannot fix this — the design is already right, the offset is just wrong. The fix is to make the
offset track the banner's actual presence rather than assume it (a CSS variable set on the page root,
or `top` driven by whether `hasTableContext` is true). **Say the word and I'll do it as a small PR** —
it is independent of everything below.

---

## Three things the redesign must fix that the report didn't name

Found while reading the code. Each is folded into the prompts, but they're worth stating plainly
because they explain the vague "doesn't look nice even after a lot of changes".

**1. The classic menu page runs three unrelated accent families at once.** The brand is RUMI Red
(`--brand-primary: #c00000`). The "Add to Order" CTA is green (`--feedback-success-darker: #2e7d32`,
chosen for AA contrast). The Chef's Special hero is gold — `linear-gradient(135deg, var(--color-gold-100-b), var(--color-gold-50))`
with a `2px solid var(--color-gold-300)` border and a gold-shadowed badge. Red, green and gold, none
derived from the others, plus the hero being **the only gradient surface on the page**. This is why
the Chef's Special "doesn't fit the classic theme" — it isn't in the theme. No amount of re-spacing
fixes a palette collision. **Prompt 3 puts the hero back on brand.**

**2. On mobile the action buttons aren't too big — they've been crushed to unusable.**
[`MenuItemActions.module.css`](../src/components/menu/MenuItemActions.module.css) under `@media (max-width: 600px)`:

```css
.addToOrderButton,
.feedbackButton,
.viewDetailsButton {
  padding: 0.15rem 0.4rem;
  font-size: 0.6rem;
  border-radius: 3px;
  min-height: unset;
}
```

0.6rem type and `min-height: unset` on the page's primary conversion action — well under the 44px
touch target that the category nav on the _same page_ carefully honours (`min-height: 44px`, with a
comment citing Apple/Google HIG). So the real mobile problem is that two buttons were squeezed to fit
a space that only holds one. Your instinct — one icon-ish primary action on mobile — is the right
correction, and it also repairs the touch target.

**3. "Details" is already the third route to the same sheet.** The card title is `role="button"`,
`tabIndex={0}`, Enter/Space handled, and calls the same `openDetails`
([`MenuItemDetails.tsx:41-59`](../src/components/menu/MenuItemDetails.tsx)). The image opens the
gallery. So Details duplicates an affordance the title already provides — your proposal to drop it and
make the description clickable is well-founded, and it costs nothing in reachability.

> ⚠️ One caveat on "make the description clickable": keep a **real** control. The title already does
> this correctly (role + tabIndex + key handler). If the description becomes the hit area, it must be
> the same kind of control, not a bare `onClick` on a `<p>` — otherwise the card loses keyboard access
> to Details on exactly the cards where the title wraps. The prompts below ask for a visible
> affordance on the description so this doesn't get lost in translation.

---

## How to use

1. Open [stitch.withgoogle.com](https://stitch.withgoogle.com).
2. Paste the **design-system pin** for the template you're designing (Prompt 0A classic / 0B craft)
   **first**, so palette + type are in context.
3. Paste the **Shared constraints** block once, then **one** surface prompt at a time.
4. Save the generated screens to `docs/stitch-screens/<prompt-slug>/`, keeping the light + dark pair.
5. Tick the row in the **Progress tracker** at the bottom.

> **Re-skin, not re-flow.** Keep the existing information architecture and **all four UI states** —
> loading, empty, error, success. Stitch is generating a _look_ for structure that already exists.

---

## Shared constraints — paste once, after the design-system pin

```
CONSTRAINTS that apply to every screen in this project:

BREAKPOINTS — generate all three, as separate frames:
- Mobile 390x844 (primary — most guests scan a QR at the table and order on a phone)
- Tablet 768x1024
- Desktop 1440x900

THEMES: generate a light and a dark version of every frame. Dark mode is a
deliberate atmosphere, not an inversion.

ACCESSIBILITY — non-negotiable, these are enforced by automated tests:
- Every interactive control is at least 44x44px on touch frames. No exceptions,
  especially not for the primary "add" action.
- Body and label text clears WCAG AA (4.5:1) against whatever it sits on;
  large/bold text clears 3:1. Never place light-grey text on a tinted panel.
- Every icon-only control has a visible-on-focus ring and a text label available
  to screen readers.

INTERNATIONALISATION — this app ships 10 locales:
- Labels must survive German (~1.8x longer than English: "Zur Bestellung
  hinzufügen"). Do not design a button that only fits the word "Add".
- Arabic and Hebrew render the whole page right-to-left. The layout must mirror:
  show at least the mobile card mirrored in one RTL frame.
- Prices are Swiss francs, formatted "CHF 12.50".

STATES to show for any list or card surface:
- loading (skeleton), empty ("no items"), error (retry), success (populated)
- an UNAVAILABLE item: dimmed, with a short sentence saying WHY (e.g. "Takeaway
  and Delivery only") and an inline "Switch to Takeaway" action. The add button
  is REMOVED on these, never greyed-out-and-dead.

DO NOT produce: Inter or system-ui type stacks; blue/purple CTAs; uniform grids
of identical rounded rectangles with 1px grey borders and soft drop shadows;
decorative icon flourishes; stock-photo hero with a gradient scrim.
```

---

## Prompt 0A — Classic design system pin

```
Design a design system specimen sheet for a restaurant ordering app. The style is
"classic": clean, confident, restaurant-grade — closer to a well-printed paper menu
than to a SaaS dashboard. Warm and appetising, never corporate-blue, never austere.

COLOUR — light theme:
  Page background: white (#FFFFFF)
  Card surface: near-white (#F9F9F9)
  Secondary surface: light grey (#F0F0F0)
  Primary brand: deep red (#C00000); pressed (#890303); accent red (#D9534F)
  Text: near-black ink (#1A1A1A); secondary (#666666); muted (#6B7280)
  Borders: (#DDDDDD)
  Text on red buttons: white (#FFFFFF)

COLOUR — dark theme ("dining room at night", not an inversion):
  Page background: (#1A1A1A)
  Card surface: (#252525)
  Secondary surface: (#2C2C2C)
  Primary brand: lifted red (#E06666); accent (#EC7063)
  Text: (#F0F0F0); secondary (#CDCBCB); muted (#9CA3AF)
  Borders: (#444444)
  Text on the lifted-red buttons is DARK (#1A1A1A)

CRITICAL PALETTE RULE — this is the main thing to fix:
The existing page uses THREE unrelated accent families at once — a red brand, a
GREEN primary call-to-action, and a GOLD featured-dish panel. Unify them. The
primary call-to-action must be derived from the brand red, not from an unrelated
green. If a success/confirmation colour is needed it is a small semantic signal
(a checkmark, a toast), never the page's main button. Any "featured / special"
treatment must also be built from the brand red, not from gold.

TYPOGRAPHY — no Inter, no system-ui. Two families:
- Headings and dish names: a warm high-contrast serif with real personality
  (in the spirit of Playfair Display or Lora). Dish name ~1.15rem on a card,
  section headings ~1.75rem.
- Body, prices, labels and buttons: a clean humanist sans (in the spirit of
  Source Sans or Public Sans), 0.95rem at 1.55 leading. Prices are tabular
  figures, semibold, so a column of prices aligns.

SURFACES: cards are flat with a hairline border and at most a very soft shadow
(0 1px 3px rgba(0,0,0,.06)). One corner radius across the whole system (10px).
NO gradients anywhere on the menu page.

Generate light and dark swatch sheets side by side showing: surfaces, the text
hierarchy, primary/accent blocks, a sample dish card, a primary button in rest
and pressed states, a price in tabular figures, and a "special" badge built from
the brand red.
```

---

## Prompt 0B — Craft design system pin

Craft already has a pinned design system. **Use Prompt 1 of
[`craft-stitch-prompts.md`](craft-stitch-prompts.md)** verbatim — cream paper `#FFF9F2`, terracotta
`#A84B2F`, Amatic SC / Caveat / Quicksand, letterpress `3px 3px 0` shadows, organic radius,
masking-tape labels, dotted menu-leaders, zero gradients. Do not re-derive it here; the values in that
prompt match the shipped `src/templates/craft/tokens.css`.

---

## Prompt 1 — Menu item card, CLASSIC (the buttons problem)

```
Design the MENU ITEM CARD for the classic restaurant app, at all three breakpoints,
light and dark. This is the single most repeated element on the page — it appears
15-40 times in a scrolling list — so its density decides whether the page feels
calm or cluttered. Today it carries TWO full-size text buttons ("Add to Order" and
"Details") which dominate the card on desktop and get crushed to 0.6rem unreadable
chips on mobile. Fix that.

CONTENT the card must carry:
- dish photo (with a "3 photos" count chip when there are several; tapping the
  photo opens a gallery)
- dish name (this is ALSO the control that opens the details sheet)
- one- or two-line description
- price, e.g. "CHF 12.50"
- optional: allergen chips, dietary tags (vegan / spicy), a "Special" badge
- for a combo: a small "includes" line, e.g. "Pizza + Cola"
- optional unavailability notice + "Switch to Takeaway" inline action

ACTION MODEL — this is the change being designed:
- Drop the separate "Details" button. The dish NAME already opens the details
  sheet, so the button is a third route to the same place.
- Instead, make the DESCRIPTION block the details affordance, with a VISIBLE cue
  that it is tappable — e.g. the description truncated to two lines followed by a
  small inline "Details" text-link or a chevron. It must read as a control, not as
  decorative text.
- Keep exactly ONE prominent action on the card: add to order.
  - Desktop / tablet: a compact labelled button ("Add to Order"), brand red,
    sized to the text, NOT full width, sitting on the price row.
  - Mobile: a single circular icon button (a plus glyph, or a plus-on-basket),
    minimum 44x44px, brand red, on the trailing edge of the price row, opposite
    the price. It must have an accessible label even though it shows no text.
- When the item is unavailable the add control is REMOVED and the reason sentence
  plus "Switch to..." action takes its place.

LAYOUT:
- Mobile 390: a horizontal row — square thumbnail (~88px) on the leading edge,
  text block filling the rest, price and the round add button sharing the bottom
  row. Target roughly 5 cards visible per screen. Cards separated by a hairline
  rule rather than each being a floating shadowed box.
- Tablet 768: two-column grid of cards, photo on top.
- Desktop 1440: three-column grid, photo on top, generous internal padding.

Also generate: the loading skeleton, the unavailable/dimmed variant, an
admin-logged-in variant (see Prompt 5), and one mobile frame mirrored for Arabic
right-to-left.
```

---

## Prompt 2 — Menu item card, CRAFT

```
Design the MENU ITEM CARD for the CRAFT template (Prompt 1 design system: cream
paper, terracotta ink, Amatic SC / Caveat / Quicksand, letterpress shadows,
organic wobbly radius, dotted menu-leaders, zero gradients), at all three
breakpoints, light and dark.

Same content and the same ACTION MODEL as the classic card: no separate Details
button (the dish name already opens the sheet), the description block becomes the
details affordance with a visible cue, and exactly one prominent add action —
labelled on desktop, a 44px round icon button on mobile.

CRAFT-SPECIFIC:
- The name-and-price row is a DOTTED MENU-LEADER: "Lamb Kofte ········ CHF 18.50",
  like an old printed menu. The dots must not collide with a long German dish name
  — show a wrapped long-name example.
- The card is a piece of warm paper with a hard-edged letterpress offset shadow
  (3px 3px 0 in the kraft border colour), an organic non-uniform radius, and a
  slight hand-placed rotation of about 1 degree. Rotations must ALTERNATE sign
  down the list so it looks hand-stacked, not systematically skewed.
- The add button is a rubber-stamp / hand-cut shape in terracotta, pressing DOWN
  (shadow shrinks to 1px 1px 0) when tapped.
- The "Special" badge is a torn masking-tape strip in Caveat, tilted ~-1.5deg.
- The unavailable state should read like a hand-struck-through line on the paper —
  still legible, obviously not orderable — with the reason in Caveat beneath.

Note: at mobile the letterpress shadow plus rotation on 30 stacked cards can feel
noisy. Show one frame with the full treatment and one calmer frame where only the
rotation is kept and the shadow is reduced, so the two can be compared.
```

---

## Prompt 3 — Chef's Special hero, CLASSIC (the "doesn't fit / too tall" problem)

```
Redesign the "CHEF'S SPECIAL" featured-dish banner at the top of the classic menu
page. All three breakpoints, light and dark.

WHAT IS WRONG TODAY, and must be fixed:
1. It is GOLD — a gold gradient panel with a 2px gold border and a gold badge —
   on a page whose brand is deep red (#C00000). It is the only gradient surface on
   the page. It reads as a component borrowed from another product. Rebuild it in
   the brand red family: a flat brand-tinted panel or a thin red rule, no gold, NO
   GRADIENT.
2. It is too tall. It currently spends ~2rem padding, a 2rem dish title, a 2rem
   price and three separate 1.5rem bottom margins before the guest reaches the
   actual menu. On mobile it can fill most of the first screen. The menu itself
   should begin within the first screenful.

TARGET: a horizontal, compact "today's special" strip, not a hero card.
- Desktop: a single band, max ~180px tall — photo on the leading edge at a fixed
  modest width, then name, one-line description, prep time, price, and one add
  button, all on a baseline-aligned row. It should read as a promoted ROW of the
  menu, not a landing-page hero.
- Tablet: same band, description truncated to one line.
- Mobile: max ~120px tall — small square photo, name, price, round add button.
  Nothing else. The description and prep time drop out entirely.

The label "Chef's Special" is a small flat badge in the brand red — not a large
pill with a coloured glow shadow. A star glyph is optional and must be small.

CONTENT available: photo, dish name, description, preparation time in minutes,
price, allergen chips, an unavailability notice with a "Switch to..." action, and
(for admins) an edit-item link and inline price control — see Prompt 5.

Also show: the variant with NO photo (the live tenant's special often has none —
the layout must not leave a hole where the photo would be), and the dimmed
unavailable variant.
```

---

## Prompt 4 — Chef's Special hero, CRAFT

```
Design the "CHEF'S SPECIAL" featured-dish banner for the CRAFT template (Prompt 1
design system), all three breakpoints, light and dark.

Same brief as the classic version on SIZE — this is a compact promoted strip, not
a hero. Desktop max ~180px tall, mobile max ~120px. The menu must start within the
first screenful.

CRAFT TREATMENT:
- The whole strip reads as a small chalkboard or a card pinned to the menu — kraft
  panel, letterpress offset shadow, organic radius, tilted about -1 degree.
- The label "Chef's Special" is a torn masking-tape strip in Caveat across the top
  leading corner, overlapping the panel edge as if actually stuck on.
- The dish name is Amatic SC, large but on ONE line with the price on a dotted
  leader beneath it.
- The add action is the same rubber-stamp terracotta control as the card.
- Zero gradients. Nothing gold-metallic — saffron is a flat pigment, not a shine.

Show the no-photo variant and the unavailable variant.
```

---

## Prompt 5 — Admin inline price control, three states

```
Design an ADMIN-ONLY inline price control that sits directly beside a dish price,
on both a menu card and the featured-special strip. Design it for the classic
system (Prompt 0A) and note how it would translate to craft. Light and dark, and
at mobile 390 as well as desktop — it must not break the card's price row on a
phone.

This control only appears when a restaurant admin is logged in and browsing the
public menu. It has THREE states and all three must be visually distinct at a
glance:

STATE 1 — REST: a small control offering to edit the price. Today it is a dashed
grey outlined pill with a tag glyph reading "Edit price". It is easy to miss and
looks like a disabled chip. Make it read clearly as an available admin action
without shouting over the customer-facing content around it — this is a
back-of-house control living on a customer page, so it should feel like a distinct
"admin layer" (a consistent admin accent, or a subtle tinted surface) rather than
competing with the add-to-order button.

STATE 2 — EDITING: replaces the rest control in place. A currency marker "CHF"
beside a numeric input, a confirm control and a cancel control, plus room BELOW
for an error sentence (e.g. "Enter a price of 0 or more", or a message returned by
the server). Constraints: the input must fit a four-figure price without clipping
under the number spinner; confirm must be visibly the primary of the two and must
not sit where a mis-tap hits cancel; the error text must clear WCAG AA on the card
surface in BOTH themes. Show the error state populated.

STATE 3 — LOCKED: for dishes whose price cannot be edited inline — a combo (its
price comes from its component items) or a dish with per-variation prices. This
must NOT look like a missing control or a disabled button. It is a deliberate,
informative refusal: a lock glyph plus a short sentence naming the reason, legible
enough that an admin reads it as an answer rather than as a bug. This state is
currently a low-contrast grey pill that reads as absence — that is the specific
thing to fix.

Show all three states inline in a real card price row, at mobile and desktop, so
the row's alignment can be checked in each. Also show state 1 and state 3 in the
featured-special strip.
```

---

## Prompt 6 — Sticky category navigation, both templates

> Design only. The empty-strip bug is a CSS offset error — see the Triage section — and is fixed in
> code, not here. Worth a prompt anyway because the bar's _look_ is dated.

```
Design the STICKY CATEGORY NAVIGATION bar for the menu page. Two versions —
classic (Prompt 0A) and craft (Prompt 1 of the craft prompt doc). All three
breakpoints, light and dark.

BEHAVIOUR it must express: the bar sticks directly beneath the site header as the
guest scrolls the menu. It scrolls horizontally when the categories overflow, with
back/forward arrow controls appearing only when there is more to scroll. One
category is active at a time.

CONTENT: an "All" tab, then tenant-authored category names (Starters, Pizzas,
Desserts...), plus a "Combos" tab. Category names are tenant-written and can be
long or in German/Turkish/Arabic. A category can additionally carry a small
restriction note as a second line inside the tab, e.g. "Takeaway only".

REQUIREMENTS:
- Tabs are at least 44px tall on touch frames.
- The bar must sit FLUSH under the header with no dead space above it.
- It must feel light — it is persistent chrome sitting above the content the guest
  actually came for. It should not read as a heavy toolbar with a hard shadow.
- The active tab must be distinguishable without relying on colour alone.
- Show the RTL mirrored version: the tabs, the scroll direction and the arrow
  glyphs all flip.
- Show a frame with 3 categories (no arrows needed) and one with 9 (arrows shown,
  mid-scroll, with tabs cut off at both edges).

CLASSIC: rounded pill tabs, brand red for the active tab. Currently they are grey
pills with a red active state and a drop shadow under the bar — modernise;
consider an underline/indicator treatment instead of filled pills.

CRAFT: the tabs are torn masking-tape strips in Caveat at slight alternating
angles, the active one pressed flat and inked terracotta.
```

---

## Prompt 7 — Whole menu page, CLASSIC

> Use this when you want to judge the page as a composition rather than fixing parts — it's the
> "redesign the whole menu page" option you asked about.

```
Design the COMPLETE public menu page for the classic restaurant app, as one
composition. All three breakpoints, light and dark. Use the classic design system
(Prompt 0A) and obey the shared constraints.

THE PAGE, top to bottom:
1. Site header (logo, language switcher, theme toggle, cart) — treat as fixed
   chrome ~80px tall; you do not need to redesign it, just leave room.
2. An optional table banner ("You are seated at Table 7", dismissible) that is
   present ONLY for a guest who scanned a QR at the table. The page must look
   correct both with and without it — show both.
3. The Chef's Special compact strip (Prompt 3).
4. The sticky category nav (Prompt 6).
5. The dish grid/list (Prompt 1), with pagination at the bottom.
6. A floating cart button on mobile showing item count and total.

WHAT THE COMPOSITION MUST ACHIEVE — the current page fails on all four:
- The actual MENU must begin within the first screenful on mobile. Today a tall
  gold hero plus the banner plus the nav can push the first dish below the fold.
- ONE accent family across the whole page. No unrelated green button and no gold
  panel — see the palette rule in Prompt 0A.
- The eye should be able to scan a column of dish names and prices vertically
  without being interrupted by a repeated pair of heavy buttons on every row.
- The page should feel like a restaurant's menu, not a product catalogue. Density
  and typography carry it, not card chrome.

Show the four page states: loading (skeletons), empty ("no dishes in this
category"), error (retry), and populated. Show one mobile frame in Arabic RTL.
```

---

## Prompt 8 — Whole menu page, CRAFT

```
Design the COMPLETE public menu page for the CRAFT template, as one composition.
All three breakpoints, light and dark. Craft design system = Prompt 1 of the craft
prompt doc (cream paper, terracotta, Amatic SC / Caveat / Quicksand, letterpress,
organic radius, masking tape, dotted leaders, ZERO gradients).

Same page structure and the same four composition goals as Prompt 7 — menu visible
within the first screenful on mobile, one accent family, a vertically scannable
column of dishes, restaurant-not-catalogue.

CRAFT COMPOSITION NOTES:
- The page is a sheet of warm paper. Think a hand-printed menu card, or a folded
  bistro menu — the dish list is the primary texture.
- Section headings are masking-tape labels; dish rows are dotted leaders.
- Restraint is the risk here: 30 rotated, letterpress-shadowed cards in a column
  becomes visual noise. Show one frame at full treatment and one restrained frame
  where the shadow and rotation are dialled back on the list (kept on the special
  strip and the section labels), so the two can be compared side by side.
- Dark mode is the "late-evening kitchen" — warm aubergine paper under a low lamp,
  apricot ink. Not an inverted cream.

Show the four page states and one Arabic RTL mobile frame.
```

---

## Progress tracker

| #   | Surface                        | Template | Generated                                                     | Implemented          |
| --- | ------------------------------ | -------- | ------------------------------------------------------------- | -------------------- |
| 0A  | Design system pin              | classic  | ☑ `design_system_specimen_sheet/`, `heritage_table/DESIGN.md` | ☑                    |
| 0B  | Design system pin              | craft    | —                                                             | reuse craft Prompt 1 |
| 1   | Menu item card                 | classic  | ☑ `{mobile,tablet,desktop}_menu_{light,dark}/`                | ☑                    |
| 2   | Menu item card                 | craft    | ☐                                                             | ☐                    |
| 3   | Chef's Special strip           | classic  | ☑ `{mobile,tablet,desktop}_special_*/`                        | ☑                    |
| 4   | Chef's Special strip           | craft    | ☐                                                             | ☐                    |
| 5   | Admin price control (3 states) | classic  | ☑ `*_admin_price_controls_*/`                                 | ☑                    |
| 6   | Sticky category nav            | classic  | ☑ `classic_nav_*/`                                            | ☑                    |
| 6b  | Sticky category nav            | craft    | ☑ `craft_nav_*/`                                              | ☐                    |
| 7   | Whole menu page                | classic  | ☑ `*_menu_*_full_page/`, `*_states*/`                         | ☑                    |
| 8   | Whole menu page                | craft    | ☐                                                             | ☐                    |

**Classic is implemented** (this PR). The design system landed as `heritage_table/DESIGN.md` — Playfair
Display + Public Sans, a single 10px radius, hairline borders, one soft shadow, and the rule that
decided most of the work: _"green for success or gold for premium features are strictly prohibited to
maintain brand integrity."_

### Off-palette surfaces — now closed

Both were deliberately left out of the classic-menu PR (#452) because they are separate components,
and both were closed straight after in **#454**:

- **`CartContents` "Proceed to Checkout"** — was `--success-color-darker` green, the last green CTA
  on a page whose every other action had moved to the brand. Now `--brand-primary`, with
  `--text-on-primary` so the ink flips with the theme.
- **`TableBanner`** — was an iris→plum `linear-gradient`, i.e. a fourth accent family _and_ the last
  gradient on the page. Now flat brand. It also rendered the literal string `{{number}}` to any
  guest who scanned a table QR, because `t()` was called with no interpolation values while all ten
  locales carry the placeholder; fixed by interpolating rather than by editing translations, since
  `tr` and `zh` put the token mid-sentence.

## After the screens exist

Implementation order that keeps each PR small and independently shippable:

1. **The nav offset fix** — independent of every design, ship it now (Triage §4).
2. **Prompt 1/2 card actions** — biggest visible win, and it repairs the sub-44px
   mobile touch target at the same time.
3. **Prompt 3/4 special strip** — pure layout + palette, no behaviour change.
4. **Prompt 5 admin price control** — smallest blast radius, admin-only surface.
5. **Prompt 6 nav skin**, then **7/8** only if the composition still doesn't hold
   after 1-4 land. It may not be needed.

Craft surfaces go through `src/templates/craft/surfaces.ts`; classic edits the shared components under
`src/components/menu/`. Both are covered by the menu-and-cart e2e axe-core pass, which will catch a
contrast or touch-target regression — check it stays green rather than assuming.

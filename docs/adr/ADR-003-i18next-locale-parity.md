# ADR-003 — i18next + 9 locales with parity rule

**Status:** Accepted
**Date:** 2026-04-27
**Author:** mahmutkaya
**References:**
- `src/locales/{en,de,tr,it,ar,fr,es,ru,zh}.json`
- `src/i18n/` — i18next setup
- [DEVELOPMENT-GUIDELINES.md](../DEVELOPMENT-GUIDELINES.md)

---

## Context

RUMI Restaurant serves a multilingual customer base in Geneva and via a multilingual web menu. Nine locales were chosen based on the actual customer mix: English, German, Turkish, Italian, Arabic, French, Spanish, Russian, Chinese. Three forces:

1. **Customer-facing strings must never appear untranslated.** A missing key falling back to a placeholder or another language is a worse UX than just shipping the English string — but worse still is a key existing in `en.json` and missing in `tr.json`, because i18next's default behaviour is to render the key name itself ("menu.add_to_cart") which looks broken.
2. **RTL support for Arabic.** Layout adjustments needed beyond just translation.
3. **The frontend is a thin client over a backend** — translation happens in the frontend; backend returns IDs and structured data. We don't need server-side i18n.

## Decision

**Use i18next with `react-i18next` for all UI strings. Maintain locale parity as a hard rule: every key added to `en.json` must be added to all 8 other locales in the same MR.**

### Setup

- Locale files live in `src/locales/<locale>.json` — flat or nested JSON, namespaced by feature.
- Default locale: `en`. Fallback: `en`.
- Locale detection: cookie + Accept-Language header + `?lang=` query param (in that priority).
- All UI strings in components use the `t('key')` pattern via `useTranslation()`.

### Locale-parity rule

Any MR that adds, removes, or modifies a key in any locale file must touch all 9 locale files. Enforced by:

- The MR template's "i18n parity" section (every locale gets a checkbox)
- Code review (until automated check lands in Sprint 2)
- Sprint 2: `scripts/check-quality.mjs` will fail if any key in `en.json` is missing from another locale

### RTL handling

- Arabic (`ar`) is the only RTL locale.
- Layout components that mirror in RTL must use logical CSS properties (`margin-inline-start` not `margin-left`, `padding-inline-end` not `padding-right`, `text-align: start` not `text-align: left`).
- The `<html dir>` attribute is set to `rtl` when locale is `ar`, `ltr` otherwise.
- All components that have left/right asymmetry must be tested in `ar` locale before merge.

## Consequences

### Positive
- **Industry-standard library** — react-i18next has good TypeScript support, namespace splitting, plurals, interpolation, ICU formatting available if needed.
- **Locale parity is enforceable** — the rule is mechanical, the check is mechanical.
- **Server Components compatible** — static translations work in RSC without round-trips.
- **Translator-friendly** — flat JSON files are easy to ship to translation services if/when we move beyond manually-maintained locales.

### Negative
- **9 files to touch on every string change.** Friction is real. Mitigated by the parity check (the friction surfaces immediately, not in production).
- **Translation quality risk** — agents and devs add translations for languages they don't read (especially `ar`, `ru`, `zh`). Risk of awkward / wrong translations. Mitigated by the AI guardrail in `CLAUDE.md` §9: never *rephrase* existing translations in non-readable locales without explicit user instruction; *adding* new keys with placeholder translations marked for later review is OK.
- **Bundle weight** — all 9 locales ship with the app today. ~50 KB gz combined. Acceptable; future optimisation: dynamic-import per-locale on user selection.
- **No locale-specific routing** today. URL is locale-agnostic. If SEO or share-link semantics ever need per-locale URLs, that's a Next.js i18n routing change.

### Mitigation for the negatives
- Sprint 2 `scripts/check-quality.mjs` enforces parity.
- AI guardrail in CLAUDE.md prevents agents from "fixing" translations in languages they can't read.
- Document for translators: keys that are clearly placeholder (e.g. `[NEEDS_TRANSLATION] xyz`) get prioritised in the next translation pass.

## Alternatives considered

### Alternative A: next-intl
Modern, App-Router-first, with built-in routing support and ICU MessageFormat. Strong choice for greenfield. Rejected because i18next is already in place, has feature parity for our needs, and migration cost (rewrite every `t()` callsite + locale-file format conversion) is unjustified by the benefit.

### Alternative B: react-i18next without parity rule
Let locales drift; render the key name when missing. Rejected because rendering `menu.add_to_cart` to a Geneva customer ordering in Arabic is a bug, not a graceful degradation.

### Alternative C: Sentence-key pattern (`t("Add to cart")`)
Use full English sentences as keys; missing translations fall back to the key (which IS the English text). Pro: easy fallback. Con: every typo in English requires touching every locale file; refactoring keys becomes a translation event. Rejected for refactor-friendliness.

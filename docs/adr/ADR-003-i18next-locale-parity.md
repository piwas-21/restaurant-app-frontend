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

---

## Amendment — 2026-09-04: plural keys are a FAMILY (#590)

The parity rule above was implemented as a byte-identical key set across the bundles (`nl` joined in
PR #126, so ten today, not nine). That made a **correct i18next plural impossible by construction**:
i18next spells one counted sentence as a family of suffixed keys, and the categories a language has
differ — `ar` six, `ru` four, `fr`/`es`/`it` three, `de`/`en`/`nl`/`tr` two, `zh` one. Every category
`en.json` lacks was reported as `extra`; every `en` category a one-category language must not have was
reported as `missing`. There is no baseline for key parity, so there was no escape hatch either.

The cost was paid in **copy, not in CI time**: three merged PRs (#569, #582, #589) each independently
rewrote a counted noun into a label plus a number — `🌐 10 languages` → `🌐 10`, `Add 3 ingredients` →
`Add selected (3)`, `2 fields need attention` → `Fields to fix: 2` — and each recorded the rewrite as a
deliberate deviation. Stilted in English; worse in the inflected languages the rule exists to protect.

**Decision.** `scripts/check-locale-parity.mjs` validates a plural base as a family:

1. A base is plural only when `en.json` carries **both** `base_one` and `base_other`. An ordinary key
   that merely ends in a suffix (`discount_value_must_be_greater_than_zero`) is untouched.
2. Each locale must carry **exactly** `new Intl.PluralRules(locale).resolvedOptions().pluralCategories`
   for that base — no more, **and no less**. Same ICU data i18next uses to pick a suffix at runtime, so
   the gate demands exactly the keys the renderer will look up, and no hand-written table can drift.
3. Every non-family key keeps byte parity, a hard zero.
4. Both value gates judge a category `en.json` does not have (`ar`'s `_few`) against the English
   `_other`, so a plural form cannot drop an interpolation or ship the English sentence unnoticed.

This is **net stricter**, which is the counter-intuitive part: before, nothing could stop a Russian
bundle from having no plural handling at all, because the only shape the gate permitted was the one
that cannot express plurals. It now *demands* `ru`'s `_few`/`_many` and `ar`'s `_two`.

Two facts the issue got wrong, worth recording because both would have been baked into a hand-written
table: CLDR gives **Turkish two** cardinal categories (`one`, `other`), not one; and it gives
**`fr`/`es`/`it` a `_many`**, used for compact millions. Derive, do not tabulate.

Fixtures live in `src/locales/localeUntranslatedGate.test.ts`, which runs the real script against
temp-tree bundles.

### Amendment — 2026-09-04: a key with no value, and text no bundle can reach (#610)

Two holes the parity rule above could not see, both found on production data.

**1. An empty value passes both halves.** Key parity counts KEYS, and the walk treats `null` as a leaf, so a
`null` key is *present* and parity holds. The untranslated check compares values TO ENGLISH, and `null` is not
equal to the English string, so it is not a match either. Four `cashier.*` order statuses (`pending`,
`confirmed`, `preparing`, `ready`) shipped `null` in `tr.json` — a Turkish cashier read English order
statuses while every gate was green. The gate now rejects `null`, blank, whitespace-only and non-string values
in every bundle including `en.json`. **Zero tolerance, no baseline**: unlike an untranslated value, an empty
one is never legitimate.

**2. No bundle can reach a literal.** `{points} pts` written inline in JSX and `toLocaleTimeString()` with no
locale argument are invisible to *both* i18n gates by construction — `check-t-keys.mjs` reads `t()` callsites
and `check-locale-parity.mjs` reads bundles; a literal is neither. Translating all ten files fixes nothing.
The rule: a unit is a key, and a date/time format takes `i18n.language || 'en'`. `[]` is not "no preference",
it is the browser's locale.

### Amendment — 2026-09-04: a key nothing reads (#439)

Parity asks *"does every locale have the same keys as `en.json`?"*. It never asks *"does anything READ this
key?"*, so a key deleted from a component stays in all ten bundles forever, fully parity-compliant, and every
gate stays green. A survey of `origin/develop` found **581 of 2966 keys (19.6%)** with no reference anywhere —
~5,800 dead JSON lines carried through every translation pass, and noise dense enough to hide two real bugs
(#210 shipped English in `ru`, #134 hardcoded a city).

**Decision.** `scripts/check-locale-orphans.mjs` is a third question, alongside parity (bundle-vs-bundle) and
`check-t-keys.mjs` (callsite-vs-bundle). 563 provably-unreferenced keys were deleted from all ten bundles;
the gate now fails on the next one.

The design is shaped by three ways this kind of gate goes wrong, each of which was **measured, not imagined**:

1. **Scanning callsites instead of text.** 16 files hold a literal KEY TABLE (`ORDER_STATUS_META`,
   `MENU_TYPE_FILTER_LABEL_KEYS`, `DAY_KEYS`, …) and call `t(TABLE[x].key)`. A gate looking for `t('literal')`
   reports every one dead. The gate searches for the key STRING anywhere, never for the shape of the call.
2. **Treating a derived file as code.** `scripts/*-baseline.json` are generated FROM `en.json`, so they name
   the keys under test; counting them marks 75 orphans live. The gate's own allowlist is the same trap one
   level in — `scripts/` is in the corpus, so without excluding itself every allowlisted key marks itself
   used. Both are excluded, both have fixtures.
3. **Deleting a key built at runtime.** 138 keys come from a prefix; those are allowlisted by prefix. And
   `categoryNameMapper` lowercases a category name a TENANT typed into their database and uses it as a key —
   `salads`, `meze`, `seafood`. That cannot be settled from source **at all**, so those keys are WARNED
   about, never failed on, and never deleted without a human.

The bias throughout is fail-CLOSED against deletion: ambiguous evidence counts as USED, including a mention in
a comment. The gate exists to stop the NEXT orphan, not to win an argument about an existing one.

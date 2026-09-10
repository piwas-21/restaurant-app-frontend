import ar from '@/locales/ar.json';
import de from '@/locales/de.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import itIT from '@/locales/it.json';
import nl from '@/locales/nl.json';
import ru from '@/locales/ru.json';
import tr from '@/locales/tr.json';
import zh from '@/locales/zh.json';

/**
 * The copy guard for `PaymentsTab` under Connect **Express**.
 *
 * `PaymentsTab.test.tsx` mocks `t` to return the KEY, which is what makes it a test of wiring
 * rather than of wording — and it therefore cannot see a sentence that has become untrue. This
 * file asserts the WORDS, in every bundle, and it exists because one of them was dangerous:
 *
 *   "Payments go straight to your own Stripe account — we never hold your money."
 *
 * That was accurate under Connect Standard. Under Express, `controller.losses.payments` is
 * `application`: Stripe debits this restaurant's balance and then its bank account, and what it
 * cannot recover is ours — while it tries, Stripe holds a reserve in OUR platform balance. A
 * restaurant reads that line to decide whether to trust us with its takings, so it was re-stated
 * rather than deleted: the money settles to their account, and we take a per-transaction fee only
 * when one is agreed (zero for every tenant today).
 *
 * `payments_tab_dashboard_link` went with it. An Express account has no full Stripe dashboard, so
 * the label no longer describes anywhere the restaurant can go.
 *
 * The second sentence was TWINT. "We switch TWINT on" measured FALSE on the LIVE platform
 * 2026-09-05 — the PLATFORM `twint_payments` capability was `inactive` (a connected Express
 * account reported `twint.available: false`; a display-preference write returned 200 while
 * `available` stayed false; TEST mode answered `available: true`, which is how the claim had
 * shipped in #726) — and #728 retired the promise. On 2026-09-06 Stripe approved the platform
 * capability, after piwas.nl went live and the profile URL was fixed. The mint now requests
 * the capability at account creation and the platform approves it, so the promise is TRUE
 * AGAIN for accounts minted from now on: TWINT is switched on as part of setup and activates
 * when the restaurant finishes Stripe's onboarding — part of setup, never "instantly". The
 * #728 directions are inverted below, and every matcher was re-proven both ways.
 */
// `it` is jest's test function here, so the Italian bundle is imported under another name.
const BUNDLES = { ar, de, en, es, fr, it: itIT, nl, ru, tr, zh } as const;

type Bundle = Record<string, unknown>;

type Locale = keyof typeof BUNDLES;
const LOCALES = Object.keys(BUNDLES) as Locale[];

const RETIRED_KEY = 'payments_tab_dashboard_link';
const LIVE_KEY = 'payments_tab_stripe_link';

/**
 * The present-tense TWINT promise, restored, in each bundle's own words. Every one of these was
 * verified to match the restored copy TWICE (once per hint) and the retired #728 copy zero
 * times, so the matcher is known to discriminate rather than merely to return nothing.
 */
const TWINT_PROMISED_NOW: Record<Locale, RegExp> = {
  ar: /نفعّل\s+(?:\S+\s+){0,2}TWINT|TWINT\s+(?:\S+\s+){0,2}نفعّل/,
  de: /schalten\s+(?:\S+\s+){0,2}TWINT\s+(?:\S+\s+){0,2}frei|TWINT\s+schalten\s+wir/i,
  en: /we\s+switch\s+(?:\S+\s+){0,2}TWINT\s+on|TWINT\s+(?:\S+\s+){0,2}we\s+switch\s+on/i,
  es: /activamos\s+(?:\S+\s+){0,2}TWINT|TWINT\s+(?:\S+\s+){0,2}activamos/i,
  fr: /activons\s+(?:\S+\s+){0,2}TWINT|TWINT[^.!?]{0,24}activons/i,
  it: /attiviamo\s+(?:\S+\s+){0,2}TWINT|TWINT[^.!?:]{0,24}attiviamo/i,
  nl: /zetten\s+(?:\S+\s+){0,3}TWINT(?:\s+\S+){0,3}\s+aan|TWINT\s+zetten\s+wij/i,
  ru: /включаем\s+(?:\S+\s+){0,2}TWINT|TWINT[^.!?]{0,24}включаем/i,
  tr: /TWINT'i[^.!?]{0,24}açıyoruz|açıyoruz[^.!?]{0,24}TWINT'i/i,
  zh: /TWINT\s*[^。！？]{0,8}由我们|由我们[^。！？]{0,8}开通\s*TWINT/,
};

/**
 * The retired #728 deferral ("TWINT is not available yet…"), in each bundle's own words.
 * Verified to match the #728 copy TWICE (once per hint) and the restored copy zero times —
 * the proof that this matcher can see the phrase it must not find.
 */
const TWINT_NOT_AVAILABLE_YET: Record<Locale, RegExp> = {
  ar: /غير متاح بعد/,
  de: /noch nicht verfügbar/i,
  en: /not available yet/i,
  es: /todavía no está disponible/i,
  fr: /pas encore disponible/i,
  it: /non è ancora disponibile/i,
  nl: /nog niet beschikbaar/i,
  ru: /пока недоступен/i,
  tr: /henüz kullanılamıyor/i,
  zh: /目前还不可用/,
};

describe('PaymentsTab copy', () => {
  it.each(Object.entries(BUNDLES))('%s carries the Express link keys and not the retired one', (_locale, bundle) => {
    const keys = bundle as Bundle;
    // The positive control comes first: if this lookup could not find a key that IS there, the
    // absence assertion below would be worthless — an empty result would only prove the
    // instrument is blind.
    expect(typeof keys[LIVE_KEY]).toBe('string');
    expect(typeof keys.payments_tab_stripe_link_pending).toBe('string');
    expect(keys).not.toHaveProperty(RETIRED_KEY);
  });

  it('never promises that Sofra does not hold the restaurant\u2019s money', () => {
    // Searched across the WHOLE English bundle, not just the key that used to carry it: the
    // sentence must not survive by moving. Positive control on the same instrument first.
    const wholeBundle = JSON.stringify(en);
    expect(wholeBundle).toContain('Card payments settle into your own Stripe account');
    expect(wholeBundle).not.toMatch(/never hold your money/i);
  });

  it('says where the money goes and what Sofra takes', () => {
    const hint = en.payments_tab_configured_hint;
    // Where it settles, who pays it out, and the fee — the three facts that replaced the promise.
    expect(hint).toMatch(/your own Stripe account/i);
    expect(hint).toMatch(/bank account/i);
    expect(hint).toMatch(/fee/i);
  });

  it('does not send an Express account holder to a Stripe dashboard they do not have', () => {
    // Both remaining hints described a full Stripe login. Express accounts get a hosted form and
    // an Express dashboard reached through a link we mint, so the phrase must be gone from both.
    expect(en.payments_tab_awaiting_hint).not.toMatch(/dashboard/i);
    expect(en.payments_tab_not_configured_hint).not.toMatch(/dashboard/i);
    // …and the awaiting hint names the short remainder Stripe actually still wants (measured:
    // prefill takes `currently_due` from 16 fields to 6), so the owner can see it is short.
    expect(en.payments_tab_awaiting_hint).toMatch(/date of birth/i);
  });

  it('no longer tells the restaurant there is nothing for it to do', () => {
    // False under Express: we create the account, they finish a short form at Stripe.
    expect(en.payments_tab_not_configured_hint).not.toMatch(/nothing to do/i);
    expect(en.payments_tab_not_configured_hint).toMatch(/short form/i);
  });

  it('promises TWINT as part of setup instead of deferring it', () => {
    for (const hint of [en.payments_tab_not_configured_hint, en.payments_tab_awaiting_hint]) {
      expect(hint).toMatch(/we switch TWINT on/);
      expect(hint).not.toMatch(/TWINT is not available yet/);
      // The #728 sentence is retired as a whole — its "card first" clause went with it.
      expect(hint).not.toMatch(/card payment comes first/i);
      // Setup, not "live right now": the promise must not overstate the activation moment.
      expect(hint).not.toMatch(/instantly/i);
    }
    // The reassurance the owner actually needs must survive the rewrite untouched.
    expect(en.payments_tab_awaiting_hint).toMatch(/until then your restaurant is fully live and taking cash as usual/);
  });

  it.each(LOCALES)('%s promises TWINT is switched on as part of setup', (locale) => {
    const bundle = BUNDLES[locale];
    const notConfigured = String(bundle.payments_tab_not_configured_hint);
    const awaiting = String(bundle.payments_tab_awaiting_hint);

    // POSITIVE, per hint: the promise, in this bundle's own words — BOTH hints carry it.
    expect(notConfigured).toMatch(TWINT_PROMISED_NOW[locale]);
    expect(awaiting).toMatch(TWINT_PROMISED_NOW[locale]);

    // NEGATIVE: the retired #728 deferral, in this bundle's own words. The two promise matches
    // above are the positive control for this haystack — they prove the lookup found real
    // strings, so a clean `not.toMatch` cannot mean a blind instrument.
    const copy = `${notConfigured}\n${awaiting}`;
    expect(copy).not.toMatch(TWINT_NOT_AVAILABLE_YET[locale]);
  });
});

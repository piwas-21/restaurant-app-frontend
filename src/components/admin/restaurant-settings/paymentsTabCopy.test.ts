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
 * The second dangerous sentence was TWINT: "and we switch TWINT on". Measured on the LIVE
 * platform 2026-09-05 — a connected Express account reports `twint_payments: inactive` and
 * `twint.available: false`, and setting the display preference to `on` returns 200 while
 * `available` stays false. The capability is missing above the connected account, and Stripe
 * lets only full-dashboard accounts self-enable it. In TEST mode the same probe answers
 * `available: true`, which is why nobody caught it. Re-stated rather than deleted, because a
 * Swiss restaurant cares about TWINT and silence reads as "they do not support it": card
 * payment comes first, TWINT follows when we can offer it.
 */
// `it` is jest's test function here, so the Italian bundle is imported under another name.
const BUNDLES = { ar, de, en, es, fr, it: itIT, nl, ru, tr, zh } as const;

type Bundle = Record<string, unknown>;

type Locale = keyof typeof BUNDLES;
const LOCALES = Object.keys(BUNDLES) as Locale[];

const RETIRED_KEY = 'payments_tab_dashboard_link';
const LIVE_KEY = 'payments_tab_stripe_link';

/**
 * The retired present-tense TWINT promise, in each bundle's own words. Every one of these was
 * verified to match the #726 copy TWICE (once per hint) and the replacement copy zero times, so
 * the matcher is known to discriminate rather than merely to return nothing.
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

/** The replacement, in each bundle's own words — the positive control for the check above. */
const TWINT_ARRIVES_LATER: Record<Locale, RegExp> = {
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

  it('states the TWINT order of arrival instead of promising it is already on', () => {
    for (const hint of [en.payments_tab_not_configured_hint, en.payments_tab_awaiting_hint]) {
      expect(hint).toMatch(/TWINT is not available yet/);
      expect(hint).toMatch(/follows as soon as we can offer it/);
    }
    // Card payment is named as the thing that arrives first, so "not yet" is not the whole
    // message a restaurant takes away.
    expect(en.payments_tab_not_configured_hint).toMatch(/card payment comes first/i);
    // The reassurance the owner actually needs must survive the rewrite untouched.
    expect(en.payments_tab_awaiting_hint).toMatch(/until then your restaurant is fully live and taking cash as usual/);
  });

  it.each(LOCALES)('%s never says TWINT is switched on today', (locale) => {
    const bundle = BUNDLES[locale];
    const copy = `${bundle.payments_tab_not_configured_hint}\n${bundle.payments_tab_awaiting_hint}`;

    // POSITIVE CONTROL, first and on the same haystack and the same matcher family: a phrase
    // that IS in this bundle's new copy. Without it a passing `not.toMatch` below could only
    // mean the lookup found nothing at all — a missing key, a renamed key, an empty string —
    // and a blind instrument would read as a clean result.
    expect(copy).toMatch(/TWINT/);
    expect(copy).toMatch(TWINT_ARRIVES_LATER[locale]);

    // NEGATIVE: the present-tense promise shipped in #726, in this bundle's own words.
    expect(copy).not.toMatch(TWINT_PROMISED_NOW[locale]);
  });
});

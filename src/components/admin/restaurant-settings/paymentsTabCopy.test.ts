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
 */
// `it` is jest's test function here, so the Italian bundle is imported under another name.
const BUNDLES = { ar, de, en, es, fr, it: itIT, nl, ru, tr, zh } as const;

type Bundle = Record<string, unknown>;

const RETIRED_KEY = 'payments_tab_dashboard_link';
const LIVE_KEY = 'payments_tab_stripe_link';

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
});

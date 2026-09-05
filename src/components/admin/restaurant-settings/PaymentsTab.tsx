'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getPaymentsOnboarding } from '@/services/paymentsOnboardingService';
import { useApiError } from '@/hooks/useApiError';
import type { PaymentsOnboardingDto, PaymentsOnboardingState } from '@/types/paymentsOnboarding';
import styles from './PaymentsTab.module.css';

/**
 * "Where do we stand on card payments?" (SOFRA-PAYMENTS-PLAN §9 P7a).
 *
 * The tab the `online-payments` checklist row points at. That row is DERIVED on a settled
 * checkout session — money having moved — so a correctly configured restaurant reads
 * "not done yet" for as long as nobody has paid them online, which is honest and also the
 * least informative thing a page can say. This is where the smaller facts live: whether
 * the restaurant is plumbed in at all, and to which account.
 *
 * It REPORTS and never writes. There is no switch here by design (§9 constraint 4): the
 * writes in this story all happen elsewhere — the control plane creates the Stripe account
 * and the registry entry, and Stripe's own hosted page collects what only the restaurant
 * can give. A control that looked like an on/off switch would promise otherwise.
 *
 * CONNECT EXPRESS. The copy here used to describe Connect Standard, where the restaurant
 * opened its own Stripe account and we could only wait. Under Express we mint the account,
 * prefill everything we already hold, and the restaurant finishes a short hosted form —
 * measured: prefill takes Stripe's `currently_due` list from 16 fields to 6 (date of birth,
 * phone, and accepting Stripe's terms). We cannot accept those terms for them: Stripe
 * refuses it for `controller[requirement_collection]=stripe`, "which includes Standard and
 * Express accounts". So the sitting still exists — it is just short.
 *
 * TWINT. The hints used to say we switch TWINT on. Measured on the LIVE platform 2026-09-05:
 * a connected Express account reports `twint_payments: inactive`, its payment method
 * configuration reports `twint.available: false`, and writing the display preference to `on`
 * returns 200 while `available` stays false — the capability is missing one level up, and
 * Stripe lets only full-dashboard accounts turn it on themselves. In TEST mode the same probe
 * answers `available: true`, which is how the claim got shipped. The copy now says what is
 * true today: card payment comes first, TWINT follows when we can offer it. See
 * `paymentsTabCopy.test.ts` — the key-mocked tests here cannot see a false sentence.
 */
export default function PaymentsTab() {
  const { t } = useTranslation();
  const [onboarding, setOnboarding] = useState<PaymentsOnboardingDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Destructured, and that is not style. `useApiError` memoises the WHOLE surface, so its
  // identity changes whenever `message` does — putting the surface itself in `load`'s deps
  // makes the mount effect re-fire on every capture and clear, i.e. an infinite reload on
  // the exact path where the endpoint is failing. The three callbacks are stable.
  const { message: loadErrorMessage, capture, show, clear } = useApiError();
  const failedText = t('payments_tab_load_failed', 'Could not load your payment settings');

  const load = useCallback(async () => {
    setIsLoading(true);
    clear();
    try {
      const response = await getPaymentsOnboarding();
      setOnboarding(response?.data ?? null);
      setFailed(!response?.data);
      // A `success:false` envelope inside a 200 is not an answer about Stripe. It carries
      // no exception, so there is nothing to route — the banner falls back to our own
      // sentence, which is the honest one here.
      if (!response?.data) show(failedText);
    } catch (error) {
      // Every non-200 lands here and, to this page, they all mean the same thing: we
      // cannot say what state you are in. But the server's own sentence is worth more
      // than ours when it wrote one, so it is captured and rendered rather than swallowed
      // (E9). The two refusals this endpoint defines are both unreachable from here —
      // the 404 needs a tenant without the module, whose tab strip does not contain this
      // tab at all, and a 403 means an admin check already refused.
      capture(error, { fallback: failedText });
      setOnboarding(null);
      setFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [capture, show, clear, failedText]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading && !onboarding) {
    return <p>{t('loading', 'Loading...')}</p>;
  }

  if (failed || !onboarding) {
    return (
      <div className={styles.errorBanner} role="alert">
        <span>{loadErrorMessage ?? failedText}</span>
        <button type="button" onClick={() => void load()}>
          {t('retry', 'Retry')}
        </button>
      </div>
    );
  }

  // Three known states and one rule for everything else: a value this bundle does not
  // recognise reads as NOT configured. Guidance is the safe default — it tells the owner to
  // go and finish something, which is never wrong while we are unsure, whereas "you are set
  // up" would be a claim the page cannot back.
  const state: PaymentsOnboardingState =
    onboarding.state === 'configured' || onboarding.state === 'awaitingVerification'
      ? onboarding.state
      : 'notConfigured';

  // P7b's upgrade to the copy. Until the backend could read the connected account, this page
  // could only say the smaller true thing (§9 Q1) — "we are switching this on for you" —
  // because it genuinely could not tell "waiting on Stripe" from "waiting on us". Now, in the
  // one state where it CAN tell, it says the larger true thing instead. Every other state is
  // unchanged, including the soft-fail, which still lands on `configured`.
  const STATUS_KEYS: Record<PaymentsOnboardingState, { readonly key: string; readonly fallback: string }> = {
    configured: {
      key: 'payments_tab_state_configured',
      fallback: 'Your restaurant is set up to take card payments.',
    },
    awaitingVerification: {
      key: 'payments_tab_state_awaiting',
      fallback: 'Stripe still needs to verify your business.',
    },
    notConfigured: {
      key: 'payments_tab_state_not_configured',
      fallback: 'Card payments are not switched on for this restaurant yet.',
    },
  };
  // The three hints are where the Express reality is told. Each one answers "what happens to my
  // money, and what is left for me to do", and each is deliberately smaller than a promise.
  const HINT_KEYS: Record<PaymentsOnboardingState, { readonly key: string; readonly fallback: string }> = {
    configured: {
      // This sentence replaces "we never hold your money", which was true under Connect Standard
      // and is an over-claim under Express: Stripe holds a reserve in OUR platform balance against
      // this account's negative balance, and an unrecoverable loss is ours, not theirs. None of
      // that is the restaurant's business — what IS their business is where the money goes and
      // what we take, so the copy states exactly that and stops. Saying nothing was the other
      // option and it reads worse: a restaurant reads this line to decide whether to trust us.
      key: 'payments_tab_configured_hint',
      fallback:
        'Card payments settle into your own Stripe account, and Stripe pays them out to your bank account. Sofra takes a per-transaction fee only when one is agreed with you, and today that fee is zero. The checklist ticks this off after your first online payment settles.',
    },
    awaitingVerification: {
      // No "your Stripe dashboard": an Express account has no full Stripe login. The three things
      // named here are the measured `currently_due` remainder after prefill — date of birth,
      // phone, terms — so the owner can see the sitting is short before they start it.
      key: 'payments_tab_awaiting_hint',
      fallback:
        'Stripe needs a few personal details from you: date of birth, a phone number, and your acceptance of their terms. We filled in everything else. Card payment turns on by itself once Stripe is done. TWINT is not available yet; it follows as soon as we can offer it — until then your restaurant is fully live and taking cash as usual.',
    },
    notConfigured: {
      // "There is nothing to do here yet" was true when only the restaurant could open the
      // account. It is false now: we open it, and the short form is theirs.
      key: 'payments_tab_not_configured_hint',
      fallback:
        'We create your Stripe account and fill in what we already know about your restaurant. You finish a short form at Stripe — a few personal details and their terms — and card payment comes first. TWINT is not available yet; it follows as soon as we can offer it. We will tell you when card payment appears at your checkout.',
    },
  };

  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>{t('payments_tab_title', 'Card payments')}</h2>

      <p className={styles.status} data-state={state}>
        {t(STATUS_KEYS[state].key, STATUS_KEYS[state].fallback)}
      </p>

      <p className={styles.hint}>{t(HINT_KEYS[state].key, HINT_KEYS[state].fallback)}</p>

      {/* The COUNT and never the names — the backend does not send them, and it is not this
          page's business to ask. Rendered only while it means something: on a verified
          account Stripe still lists future items ahead of a deadline. */}
      {state === 'awaitingVerification' && onboarding.requirementsDue !== null && onboarding.requirementsDue > 0 && (
        <p className={styles.hint}>
          {t('payments_tab_requirements_due', '{{count}} details still to fill in on Stripe.', {
            count: onboarding.requirementsDue,
          })}
        </p>
      )}

      {onboarding.connectedAccountId && (
        <p className={styles.account}>
          {t('payments_tab_account', 'Stripe account')}:{' '}
          <code className={styles.accountId}>{onboarding.connectedAccountId}</code>
        </p>
      )}

      {/* `commissionBps` is OPTIONAL (backend ships it in a separate change) and defaults to 0.
          Absent and 0 both mean "no commission" and must render identically — nothing at all —
          so the guard checks the type before the value: `undefined > 0` is already `false`, but
          spelling out `typeof … === 'number'` is what keeps that true on purpose, not by luck. */}
      {typeof onboarding.commissionBps === 'number' && onboarding.commissionBps > 0 && (
        <p className={styles.commission}>
          {t('payments_tab_commission_rate', 'Sofra commission: {{rate}}', {
            rate: `${(onboarding.commissionBps / 100).toFixed(2)}%`,
          })}
        </p>
      )}

      {/* One link, minted by the control plane per click, and NEVER a static Stripe URL: an
          Express onboarding link expires 300 seconds after it is created, and the Express
          dashboard is reached through a login link that Stripe refuses to issue before
          onboarding finishes. When the backend has no such page to send them to it sends null
          — and an inert control that says why beats a link to a login they do not have. */}
      {onboarding.paymentsLinkUrl ? (
        <a className={styles.link} href={onboarding.paymentsLinkUrl} target="_blank" rel="noopener noreferrer">
          {t('payments_tab_stripe_link', 'Go to Stripe')}
        </a>
      ) : (
        <>
          <button className={styles.linkDisabled} type="button" disabled>
            {t('payments_tab_stripe_link', 'Go to Stripe')}
          </button>
          <p className={styles.hint}>
            {t(
              'payments_tab_stripe_link_pending',
              "Stripe's links expire within minutes, so there is no permanent one to put here. Ask us and we will send you a fresh link.",
            )}
          </p>
        </>
      )}
    </div>
  );
}

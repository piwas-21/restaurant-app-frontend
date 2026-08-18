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
 * only writes in this whole story are the founder's registry PR and Stripe's own hosted
 * pages, and a control that looked like an on/off switch would promise otherwise.
 *
 * It stops short of "has Stripe finished verifying you?" — answering that needs a call to
 * Stripe with a permission the box key does not hold today (P7b). Saying the smaller true
 * thing is the same rule §9 Q1 binds the customer-facing copy to.
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
  const HINT_KEYS: Record<PaymentsOnboardingState, { readonly key: string; readonly fallback: string }> = {
    configured: {
      key: 'payments_tab_configured_hint',
      fallback:
        'Payments go straight to your own Stripe account — we never hold your money. The checklist ticks this off after your first online payment settles.',
    },
    awaitingVerification: {
      key: 'payments_tab_awaiting_hint',
      fallback:
        'Finish the form in your Stripe dashboard and card payment turns on by itself. Until then your restaurant is fully live and taking cash as usual.',
    },
    notConfigured: {
      key: 'payments_tab_not_configured_hint',
      fallback:
        'We are switching this on for you. There is nothing to do here yet — we will tell you when card payment appears at your checkout.',
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

      <a className={styles.link} href={onboarding.dashboardUrl} target="_blank" rel="noopener noreferrer">
        {t('payments_tab_dashboard_link', 'Open your Stripe dashboard')}
      </a>
    </div>
  );
}

'use client';

import { useTranslation } from 'react-i18next';
import StatusBadge, { type StatusBadgeTone } from '@/components/design-system/StatusBadge';
import type {
  AmendmentResolutionLoyaltyQuote,
  AmendmentResolutionLoyaltyResult,
} from '@/schemas/amendmentResolutionLoyalty.schema';
import styles from './AmendmentResolution.module.css';

const stateCopy: Record<AmendmentResolutionLoyaltyResult['state'], string> = {
  None: 'orderAmendments.resolution_loyalty_none',
  AwaitingAwardSuppression: 'orderAmendments.resolution_loyalty_awaiting_award',
  PendingSettlement: 'orderAmendments.resolution_loyalty_pending',
  HeldShortfall: 'orderAmendments.resolution_loyalty_shortfall',
  Reserved: 'orderAmendments.resolution_loyalty_reserved',
  ReleasedAfterNoRefund: 'orderAmendments.resolution_loyalty_released',
  OwnerUnavailable: 'orderAmendments.resolution_loyalty_owner_unavailable',
  Resolved: 'orderAmendments.resolution_loyalty_resolved',
};

const earningDispositionCopy: Record<NonNullable<AmendmentResolutionLoyaltyQuote['earningDisposition']>, string> = {
  Unevaluated: 'orderAmendments.resolution_earning_disposition_unevaluated',
  Evaluated: 'orderAmendments.resolution_earning_disposition_unknown',
  NoCustomerOwnerAtAcceptance: 'orderAmendments.resolution_earning_disposition_no_owner',
  LoyaltyModuleDisabledAtAcceptance: 'orderAmendments.resolution_earning_disposition_loyalty_disabled',
};

interface Props {
  readonly value?: AmendmentResolutionLoyaltyQuote | AmendmentResolutionLoyaltyResult | null;
}

export default function AmendmentResolutionLoyalty({ value }: Props) {
  const { t, i18n } = useTranslation();
  if (!value) return null;
  const result = 'state' in value ? value : null;
  const held = result?.state === 'HeldShortfall' || result?.state === 'OwnerUnavailable';
  const points = (count: number) =>
    t('amendment_loyalty_points', { count: count, amount: count.toLocaleString(i18n.language || 'en') });
  const dispositionKey = value.earningDisposition
    ? earningDispositionCopy[value.earningDisposition]
    : 'orderAmendments.resolution_earning_disposition_unknown';
  const candidateStateKey = value.earningRetired ? 'orderAmendments.resolution_earning_retired' : dispositionKey;
  const candidate =
    value.earningRetired || value.candidatePoints === null
      ? { state: t(candidateStateKey) }
      : { points: points(value.candidatePoints) };
  let tone: StatusBadgeTone = 'neutral';
  if (result?.state === 'Resolved') tone = 'success';
  else if (held) tone = 'warning';
  return (
    <section className={styles.cashRefund} aria-label={t('orderAmendments.loyalty')}>
      <h4>{t('orderAmendments.loyalty')}</h4>
      {result ? (
        <StatusBadge tone={tone}>{t(stateCopy[result.state])}</StatusBadge>
      ) : (
        <p className={styles.muted}>{t('orderAmendments.resolution_loyalty_on_settlement')}</p>
      )}
      {held && (
        <p role="alert">
          {t(
            result?.state === 'HeldShortfall'
              ? 'orderAmendments.resolution_loyalty_shortfall_help'
              : 'orderAmendments.resolution_loyalty_owner_unavailable_help',
          )}
        </p>
      )}
      <dl className={styles.amounts}>
        <div>
          <dt>{t('orderAmendments.resolution_earning_candidate_points')}</dt>
          <dd>
            {'state' in candidate ? (
              <StatusBadge tone="neutral">{candidate.state}</StatusBadge>
            ) : (
              <bdi>{candidate.points}</bdi>
            )}
          </dd>
        </div>
        <div>
          <dt>{t('orderAmendments.resolution_loyalty_deduct')}</dt>
          <dd>
            <bdi>{points(value.earnedClawbackPoints)}</bdi>
          </dd>
        </div>
        <div>
          <dt>{t('orderAmendments.resolution_loyalty_restore')}</dt>
          <dd>
            <bdi>{points(value.redemptionRestorationPoints)}</bdi>
          </dd>
        </div>
        {result && (
          <>
            <div>
              <dt>{t('orderAmendments.resolution_loyalty_deducted')}</dt>
              <dd>
                <bdi>{points(result.postedClawbackPoints)}</bdi>
              </dd>
            </div>
            <div>
              <dt>{t('orderAmendments.resolution_loyalty_restored')}</dt>
              <dd>
                <bdi>{points(result.postedRestorationPoints)}</bdi>
              </dd>
            </div>
          </>
        )}
      </dl>
      <details>
        <summary>{t('orderAmendments.resolution_loyalty_award_details')}</summary>
        {value.awardPending && <p>{t('orderAmendments.resolution_loyalty_awaiting_award')}</p>}
        <dl className={styles.amounts}>
          <div>
            <dt>{t('orderAmendments.resolution_loyalty_awarded')}</dt>
            <dd>
              <bdi>{points(value.appliedAwardPoints)}</bdi>
            </dd>
          </div>
          <div>
            <dt>{t('orderAmendments.resolution_loyalty_suppressed')}</dt>
            <dd>
              <bdi>{points(value.suppressedPoints)}</bdi>
            </dd>
          </div>
          {result?.clawbackShortfallPoints != null && (
            <div>
              <dt>{t('orderAmendments.resolution_loyalty_missing')}</dt>
              <dd>
                <bdi>{points(result.clawbackShortfallPoints)}</bdi>
              </dd>
            </div>
          )}
        </dl>
      </details>
    </section>
  );
}

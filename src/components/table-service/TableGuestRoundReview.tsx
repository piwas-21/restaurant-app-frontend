'use client';

import { useTranslation } from 'react-i18next';
import type { CartItem } from '@/components/cart/cartTypes';
import TenantLink from '@/components/TenantLink';
import OrderItemsList from '@/components/checkout/OrderItemsList';
import type { PendingTableGuestRound, TableGuestRoundAcknowledgement } from '@/types/tableGuestVisit';
import styles from './TableGuestRoundReview.module.css';

interface TableGuestRoundReviewProps {
  readonly items: CartItem[];
  readonly total: number;
  readonly isSubmitting: boolean;
  readonly error: string;
  readonly pendingRound: PendingTableGuestRound | null;
  readonly pendingRoundUnavailable: boolean;
  readonly dineInUnavailable: boolean;
  readonly onRetryAvailability: () => Promise<boolean>;
  readonly acknowledgement: TableGuestRoundAcknowledgement | null;
  readonly recoveryOnly: boolean;
  readonly canSubmit: boolean;
  readonly formatPrice: (amount: number) => string;
  readonly onSubmit: () => Promise<void>;
}

export default function TableGuestRoundReview({
  items,
  total,
  isSubmitting,
  error,
  pendingRound,
  pendingRoundUnavailable,
  dineInUnavailable,
  onRetryAvailability,
  acknowledgement,
  recoveryOnly,
  canSubmit,
  formatPrice,
  onSubmit,
}: TableGuestRoundReviewProps) {
  const { t } = useTranslation();
  const isAcknowledgedWithoutBasket = Boolean(acknowledgement) && items.length === 0 && !pendingRound;
  let heading = 'table_guest_review_title';
  if (recoveryOnly) heading = 'table_guest_pending_round_notice';
  else if (isAcknowledgedWithoutBasket) heading = 'table_guest_account_title';
  let submitLabel = 'table_guest_round_action';
  if (pendingRound) submitLabel = 'table_guest_retry_round_action';
  if (isSubmitting) submitLabel = 'table_guest_joining';

  return (
    <main className={styles.page} aria-labelledby="table-round-review-heading">
      <header className={styles.header}>
        <h1 id="table-round-review-heading">{t(heading)}</h1>
        {!recoveryOnly && !isAcknowledgedWithoutBasket && <p>{t('table_guest_round_explanation')}</p>}
      </header>

      {acknowledgement && (
        <>
          <p className={styles.notice}>
            <output>{t('table_guest_round_added')}</output>
          </p>
          {isAcknowledgedWithoutBasket && (
            <p className={styles.notice}>
              {t('table_guest_round_committed_detail')}{' '}
              <TenantLink href="/menu">{t('table_guest_back_to_menu')}</TenantLink>
            </p>
          )}
        </>
      )}
      {pendingRound && (
        <p className={styles.notice}>
          <output>{t('table_guest_pending_round_notice')}</output>
        </p>
      )}
      {dineInUnavailable && !pendingRound && (
        <div className={styles.notice}>
          <output>{t('table_guest_dine_in_unavailable')}</output>
          <button className={styles.secondaryButton} type="button" onClick={() => void onRetryAvailability()}>
            {t('table_guest_unavailable_retry_action')}
          </button>
        </div>
      )}
      {recoveryOnly && pendingRoundUnavailable && (
        <p className={styles.error} role="alert">
          {t('table_guest_storage_help')}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {!recoveryOnly && items.length > 0 && (
        <section aria-labelledby="table-round-items-heading" className={styles.itemsSection}>
          <h2 id="table-round-items-heading">{t('table_guest_round_items')}</h2>
          <OrderItemsList items={items} formatPrice={formatPrice} />
          <p className={styles.total}>
            <span>{t('total')}</span>
            <strong>{formatPrice(total)}</strong>
          </p>
        </section>
      )}

      <div className={styles.actions}>
        {canSubmit && (!recoveryOnly || pendingRound !== null) && (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void onSubmit()}
            disabled={isSubmitting}
          >
            {t(submitLabel)}
          </button>
        )}
        {!recoveryOnly && (
          <TenantLink href="/cart" className={styles.secondaryButton}>
            {t('table_guest_round_edit')}
          </TenantLink>
        )}
        <TenantLink href="/table-account" className={styles.secondaryButton}>
          {t('table_guest_view_account')}
        </TenantLink>
      </div>
    </main>
  );
}

'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './GuestOrderingUnavailable.module.css';

interface GuestOrderingUnavailableProps {
  readonly onRetry: () => void;
  readonly onChangeOrderType?: () => void;
  readonly isRefreshing?: boolean;
  readonly reason: 'closed' | 'unknown' | 'type-unavailable';
}

export default function GuestOrderingUnavailable({
  onRetry,
  onChangeOrderType,
  isRefreshing = false,
  reason,
}: GuestOrderingUnavailableProps) {
  const { t } = useTranslation();
  let availabilityMessage = t(
    'order_type_unavailable',
    'This order type is unavailable right now. Choose another option or retry.',
  );
  if (reason === 'closed') {
    availabilityMessage = t('order_type_closed_now', 'Ordering is unavailable right now. Please try again later.');
  } else if (reason === 'unknown') {
    availabilityMessage = t(
      'order_type_availability_failed',
      'We could not check ordering availability. Please retry before ordering.',
    );
  }

  return (
    <section className={styles.notice} role="status" aria-live="polite">
      <AlertCircle size={20} aria-hidden="true" />
      <div>
        <p>{availabilityMessage}</p>
        <button type="button" onClick={onRetry} disabled={isRefreshing}>
          <RefreshCw size={16} aria-hidden="true" />
          {t('retry', 'Retry')}
        </button>
        {onChangeOrderType && (
          <button type="button" onClick={onChangeOrderType}>
            {t('change_order_type', 'Change order type')}
          </button>
        )}
      </div>
    </section>
  );
}

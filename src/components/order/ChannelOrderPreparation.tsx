'use client';

import { useTranslation } from 'react-i18next';
import type { OrderDto } from '@/types/order';
import { useChannelPreparation } from '@/hooks/useChannelPreparation';
import styles from './ChannelOrderPreparation.module.css';

interface Props {
  readonly order: OrderDto;
  readonly onOrderChanged?: () => void;
}

export default function ChannelOrderPreparation({ order, onOrderChanged }: Props) {
  const { t } = useTranslation();
  const preparation = useChannelPreparation(order, onOrderChanged);
  if (!preparation.target) return null;
  return (
    <div className={styles.panel}>
      <button
        type="button"
        className={styles.action}
        disabled={preparation.pending}
        aria-busy={preparation.pending}
        onClick={() => void preparation.advance()}
      >
        {t(preparation.target === 'Preparing' ? 'mark_as_preparing_button' : 'mark_as_ready_button')}
      </button>
      {preparation.failed && (
        <p role="alert" className={styles.error}>
          {preparation.error ?? t('delivery_channels.preparation_error')}
        </p>
      )}
    </div>
  );
}

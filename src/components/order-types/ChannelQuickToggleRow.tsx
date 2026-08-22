'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ALL_ORDER_TYPES } from '@/utils/orderChannels';
import { orderTypeLabel } from '@/utils/orderTypeLabels';
import { closedForLabel, closedSentence } from '@/utils/categoryChannelStatus';
import type { CategoryChannelStatus } from '@/utils/categoryChannelStatus';
import { OrderType } from '@/types/order';
import styles from './ChannelQuickToggleModal.module.css';

interface ChannelQuickToggleRowProps {
  readonly status: CategoryChannelStatus;
  readonly saving: boolean;
  readonly busy: boolean;
  readonly canSet: (orderType: OrderType, next: boolean) => boolean;
  readonly onSet: (orderType: OrderType, next: boolean) => void;
}

/**
 * One category and its three channels.
 *
 * The controls are toggle BUTTONS with `aria-pressed`, not the design system's `CheckboxField`.
 * That primitive is for a form field with a Save; this row has no Save — a tap IS the write — and
 * `aria-pressed` is the ARIA pattern for exactly that. It also gives a fingertip a whole pill to
 * hit instead of a 13px box, which is the difference between usable and not on a till mid-service.
 */
export default function ChannelQuickToggleRow({ status, saving, busy, canSet, onSet }: ChannelQuickToggleRowProps) {
  const { t, i18n } = useTranslation();

  const since = closedForLabel(status.closedForMs, t);
  const state =
    status.closed.length === 0
      ? t('quick_channels_row_all_open', 'Available for every order type')
      : closedSentence(status, t, i18n.language || 'en');

  return (
    <li className={status.closed.length > 0 ? `${styles.row} ${styles.rowRestricted}` : styles.row}>
      <div className={styles.rowHead}>
        <span className={styles.rowName}>{status.name}</span>
        {saving && <span className={styles.rowSaving}>{t('saving', 'Saving...')}</span>}
      </div>

      <p className={styles.rowState}>
        {state}
        {since !== null && <span className={styles.rowSince}> · {since}</span>}
      </p>

      <div className={styles.chips}>
        {ALL_ORDER_TYPES.map((orderType) => {
          const on = status.open.includes(orderType);
          const allowed = canSet(orderType, !on);
          return (
            <button
              key={orderType}
              type="button"
              className={on ? `${styles.chip} ${styles.chipOn}` : styles.chip}
              aria-pressed={on}
              disabled={busy || !allowed}
              title={allowed ? undefined : t('quick_channels_last_channel', 'Keep at least one order type.')}
              onClick={() => onSet(orderType, !on)}
            >
              {orderTypeLabel(orderType, t)}
            </button>
          );
        })}
      </div>
    </li>
  );
}

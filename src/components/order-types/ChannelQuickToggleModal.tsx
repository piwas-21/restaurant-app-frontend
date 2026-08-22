'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import type { CategoryChannelQuickToggle } from '@/hooks/orderTypes/useCategoryChannelQuickToggle';
import { QUICK_TOGGLE_PAGE_SIZE } from '@/hooks/orderTypes/useCategoryChannelQuickToggle';
import { OrderType } from '@/types/order';
import ChannelQuickToggleRow from './ChannelQuickToggleRow';
import styles from './ChannelQuickToggleModal.module.css';

interface ChannelQuickToggleModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly toggle: CategoryChannelQuickToggle;
}

/**
 * The panel behind the pinned trigger: every active category, one tap per channel, written
 * immediately and re-read from the server before the switch moves.
 */
export default function ChannelQuickToggleModal({ isOpen, onClose, toggle }: ChannelQuickToggleModalProps) {
  const { t } = useTranslation();
  const { statuses, loading, error, savingId, hiddenCount, canSet, setChannel } = toggle;

  const handleSet = (categoryId: string) => (orderType: OrderType, next: boolean) => {
    void setChannel(categoryId, orderType, next);
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={t('quick_channels_title', 'Order type availability')} size="md">
      <p className={styles.intro}>
        {t(
          'quick_channels_intro',
          'A tap takes effect immediately, for every screen and every guest. Guests still see the item, dimmed, with the reason.',
        )}
      </p>

      {error !== null && (
        // An <output> rather than a role="status" div — the house convention for a live region
        // (S6819), and this one genuinely appears after the panel is already on screen.
        <output className={styles.error}>{error}</output>
      )}

      {loading && <p className={styles.empty}>{t('common.loading', 'Loading...')}</p>}

      {!loading && statuses.length === 0 && error === null && (
        <p className={styles.empty}>{t('no_categories_found', 'No categories found')}</p>
      )}

      <ul className={styles.rows}>
        {statuses.map((status) => (
          <ChannelQuickToggleRow
            key={status.id}
            status={status}
            saving={savingId === status.id}
            busy={savingId !== null}
            canSet={(orderType, next) => canSet(status.id, orderType, next)}
            onSet={handleSet(status.id)}
          />
        ))}
      </ul>

      {hiddenCount > 0 && (
        <p className={styles.hidden}>
          {t('quick_channels_hidden', {
            value: hiddenCount,
            limit: QUICK_TOGGLE_PAGE_SIZE,
            defaultValue:
              '{{value}} categories are not listed here — inactive, or past the first {{limit}}. Manage them in settings.',
          })}
        </p>
      )}

      <p className={styles.footer}>
        <Link href="/admin/restaurant-settings?tab=order-types" onClick={onClose}>
          {t('category_order_types_manage', 'Manage')}
        </Link>
      </p>
    </BaseModal>
  );
}

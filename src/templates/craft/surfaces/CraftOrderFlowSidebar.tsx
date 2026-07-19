'use client';

import { useTranslation } from 'react-i18next';
import type { OrderFlowSidebarProps } from '@/components/order/OrderFlowSidebar';
import CraftCartContents from './CraftCartContents';
import styles from './CraftOrderFlowSidebar.module.css';

/**
 * Craft desktop cart rail (S15 T4 surface slot) — the "order pad": a ruled-paper
 * panel with organic corners and a hand-lettered (Caveat) heading, wrapping
 * `CraftCartContents`. Same role/props as the shared `OrderFlowSidebar`; only
 * the chrome differs. Rendered only in the craft build (resolved via
 * `surfaceOr`).
 */
export default function CraftOrderFlowSidebar({ followUp }: Readonly<OrderFlowSidebarProps>) {
  const { t } = useTranslation();

  return (
    <aside className={styles.sidebar} aria-label={t('shopping_basket', 'Shopping Basket')}>
      <h2 className={styles.title}>{t('shopping_basket', 'Shopping Basket')}</h2>
      <CraftCartContents pickType={followUp.pickType} />
    </aside>
  );
}

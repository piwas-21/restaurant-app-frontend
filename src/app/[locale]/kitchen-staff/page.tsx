'use client';

import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import styles from '@/components/kitchenStaff/MarketplaceKitchenBoard.module.css';

function LoadingKitchenBoard() {
  const { t } = useTranslation();
  return (
    <section className={styles.board} aria-busy="true">
      <p className={styles.state}>{t('loading')}</p>
    </section>
  );
}

const KitchenStaffWorkspace = dynamic(() => import('@/components/kitchenStaff/KitchenStaffWorkspace'), {
  loading: LoadingKitchenBoard,
});

export default function KitchenStaffPage() {
  return <KitchenStaffWorkspace />;
}

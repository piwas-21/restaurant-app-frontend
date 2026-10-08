'use client';

import dynamic from 'next/dynamic';
import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/components/AuthContext';
import { useModuleEnabled } from '@/contexts/ModulesContext';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import styles from './KitchenStaffWorkspace.module.css';

const MarketplaceKitchenBoard = dynamic(() => import('./MarketplaceKitchenBoard'));
const KitchenBoardNative = dynamic(() => import('./native/KitchenBoardNative'));

type WorkspaceTab = 'native' | 'marketplace';

function isKitchenStaff(role: string | undefined): boolean {
  const normalized = role?.toLowerCase();
  return normalized === 'admin' || normalized === 'kitchenstaff';
}

export default function KitchenStaffWorkspace() {
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();
  const moduleAvailable = useModuleEnabled('kitchen-board');
  const { tableAccountV1, orderAmendmentsV1 } = useTenantFeatures();
  const nativeAvailable = moduleAvailable && (tableAccountV1 || orderAmendmentsV1) && isKitchenStaff(user?.role);
  const [tab, setTab] = useState<WorkspaceTab>('native');
  const onTabKeyDown = (current: WorkspaceTab, event: KeyboardEvent<HTMLButtonElement>) => {
    let next: WorkspaceTab | null = null;
    if (event.key === 'Home') next = 'native';
    else if (event.key === 'End') next = 'marketplace';
    else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      next = current === 'native' ? 'marketplace' : 'native';
    }
    if (!next) return;
    event.preventDefault();
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-kitchen-tab="${next}"]`)?.focus();
    setTab(next);
  };

  if (isLoading) {
    return (
      <p className={styles.loading} role="status">
        {t('loading')}
      </p>
    );
  }
  if (!user || !isKitchenStaff(user.role) || !moduleAvailable || !nativeAvailable) {
    return <MarketplaceKitchenBoard />;
  }

  return (
    <section className={styles.workspace} aria-label={t('nativeKitchenBoard.workspace')}>
      <div className={styles.tabs} role="tablist" aria-label={t('nativeKitchenBoard.workspace')}>
        <button
          type="button"
          role="tab"
          id="kitchen-workspace-native-tab"
          aria-controls="kitchen-workspace-panel"
          aria-selected={tab === 'native'}
          tabIndex={tab === 'native' ? 0 : -1}
          data-kitchen-tab="native"
          onKeyDown={(event) => onTabKeyDown('native', event)}
          onClick={() => setTab('native')}
        >
          {t('nativeKitchenBoard.nativeTab')}
        </button>
        <button
          type="button"
          role="tab"
          id="kitchen-workspace-marketplace-tab"
          aria-controls="kitchen-workspace-panel"
          aria-selected={tab === 'marketplace'}
          tabIndex={tab === 'marketplace' ? 0 : -1}
          data-kitchen-tab="marketplace"
          onKeyDown={(event) => onTabKeyDown('marketplace', event)}
          onClick={() => setTab('marketplace')}
        >
          {t('nativeKitchenBoard.marketplaceTab')}
        </button>
      </div>
      <div
        className={styles.panel}
        id="kitchen-workspace-panel"
        role="tabpanel"
        aria-labelledby={tab === 'native' ? 'kitchen-workspace-native-tab' : 'kitchen-workspace-marketplace-tab'}
        tabIndex={0}
      >
        {tab === 'native' ? <KitchenBoardNative /> : <MarketplaceKitchenBoard />}
      </div>
    </section>
  );
}

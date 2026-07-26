'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import styles from './RestaurantSettingsPage.module.css';
import WorkingHoursManager from '@/components/admin/settings/WorkingHoursManager';
import OrderTypeManager from '@/components/admin/settings/OrderTypeManager';
import CategoryOrderTypeMatrix from '@/components/admin/settings/CategoryOrderTypeMatrix';
import TaxConfigurationManager from '@/components/admin/settings/TaxConfigurationManager';
import GeneralSettingsTab from '@/components/admin/restaurant-settings/GeneralSettingsTab';
import AppearanceTab from '@/components/admin/restaurant-settings/AppearanceTab';

const TAB_IDS = ['hours', 'order-types', 'tax', 'general', 'appearance'] as const;
type TabType = (typeof TAB_IDS)[number];

const isTabId = (value: string | null): value is TabType => !!value && TAB_IDS.includes(value as TabType);

function RestaurantSettingsContent() {
  const { t } = useTranslation();
  // `?tab=order-types` so other surfaces can deep-link here — EditCategoryModal's "Manage" link
  // points at the channel matrix, which lives on the Order Types tab. Read once as the initial
  // value: the tab buttons own it from then on, and re-syncing would fight them.
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<TabType>(isTabId(requestedTab) ? requestedTab : 'hours');

  const tabs = [
    { id: 'hours' as TabType, label: t('working_hours', 'Working Hours'), icon: '🕐' },
    { id: 'order-types' as TabType, label: t('order_types', 'Order Types'), icon: '📋' },
    { id: 'tax' as TabType, label: t('tax_configuration', 'Tax Configuration'), icon: '💰' },
    { id: 'general' as TabType, label: t('general_settings', 'General Settings'), icon: '⚙️' },
    { id: 'appearance' as TabType, label: t('appearance_settings', 'Appearance'), icon: '🎨' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('restaurant_settings', 'Restaurant Settings')}</h1>
        <p className={styles.subtitle}>
          {t('restaurant_settings_desc', 'Manage your restaurant configuration and operating hours')}
        </p>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'hours' && <WorkingHoursManager />}
        {activeTab === 'order-types' && (
          <>
            <OrderTypeManager />
            <CategoryOrderTypeMatrix />
          </>
        )}
        {activeTab === 'tax' && <TaxConfigurationManager />}
        {activeTab === 'general' && <GeneralSettingsTab />}
        {activeTab === 'appearance' && <AppearanceTab />}
      </div>
    </div>
  );
}

export default function RestaurantSettingsPage() {
  // `useSearchParams` needs a Suspense boundary under the App Router, same as the menu-management
  // pages.
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RestaurantSettingsContent />
    </Suspense>
  );
}

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import StaffWorkspaceShell from '@/components/design-system/StaffWorkspaceShell';
import { useTenantLocaleRouter } from '@/hooks/useTenantLocaleRouter';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import CashierSessionCollectionRoute from '@/components/cashier/CashierSessionCollectionRoute';
import ServerTasksBadge from './tasks/ServerTasksBadge';
import { serverOrderNavItem } from './serverWorkspaceOrderNav';

export default function ServerCollectionWorkspace() {
  const { t } = useTranslation();
  const router = useTenantLocaleRouter();
  const search = useSearchParams();
  const { serverWorkspaceV2, orderAmendmentsV1 } = useTenantFeatures();
  const serviceSessionId = search.get('serviceSessionId');
  const tableId = search.get('tableId');
  const orderId = search.get('order');
  const [navigationLocked, setNavigationLocked] = useState(false);

  useEffect(() => {
    if (!navigationLocked || typeof window === 'undefined') return;
    const guardedUrl = window.location.href;
    const preventPopState = (event: PopStateEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.history.pushState(window.history.state, '', guardedUrl);
    };
    window.addEventListener('popstate', preventPopState, true);
    return () => window.removeEventListener('popstate', preventPopState, true);
  }, [navigationLocked]);

  const navItems = [
    { href: '/server/floor', label: t('server.floor_plan', 'Floor') },
    { href: '/server/tasks', label: t('server.tasks.title', 'Tasks'), badge: <ServerTasksBadge /> },
    ...serverOrderNavItem(orderAmendmentsV1, t),
    { href: '/server/takeaway', label: t('server.takeaway.link') },
  ];

  let collectionContent: ReactNode;
  if (!serverWorkspaceV2) {
    collectionContent = <p role="alert">{t('cashier.collection.order_load_failed')}</p>;
  } else if (serviceSessionId) {
    collectionContent = (
      <CashierSessionCollectionRoute
        key={serviceSessionId}
        serviceSessionId={serviceSessionId}
        tableId={tableId}
        orderId={orderId}
        serverMode
        onNavigationLockChange={setNavigationLocked}
      />
    );
  } else {
    collectionContent = <p role="alert">{t('cashier.collection.order_required')}</p>;
  }

  return (
    <StaffWorkspaceShell
      navItems={navItems}
      onNavigate={(href) => {
        if (!navigationLocked) router.push(href);
      }}
    >
      {collectionContent}
    </StaffWorkspaceShell>
  );
}

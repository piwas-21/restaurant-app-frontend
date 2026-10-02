'use client';

import { useTranslation } from 'react-i18next';
import StaffWorkspaceShell from '@/components/design-system/StaffWorkspaceShell';
import MarketplaceKitchenBoard from '@/components/kitchenStaff/MarketplaceKitchenBoard';
import ServerTasksBadge from '@/components/server/tasks/ServerTasksBadge';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';

export default function ServerMarketplaceWorkspace() {
  const { t } = useTranslation();
  const { serverWorkspaceV2 } = useTenantFeatures();
  const navItems = serverWorkspaceV2
    ? [
        { href: '/server/floor', label: t('server.floor_plan', 'Floor') },
        { href: '/server/tasks', label: t('server.tasks.title', 'Tasks'), badge: <ServerTasksBadge /> },
        { href: '/server/takeaway', label: t('server.takeaway.title') },
        { href: '/server/marketplace', label: t('marketplaceStaff.kitchen_title'), active: true },
      ]
    : [
        { href: '/server', label: t('server.floor_plan', 'Floor') },
        { href: '/server/takeaway', label: t('server.takeaway.title') },
        { href: '/server/marketplace', label: t('marketplaceStaff.kitchen_title'), active: true },
      ];

  return (
    <StaffWorkspaceShell navItems={navItems} contentElement="div">
      <MarketplaceKitchenBoard audience="server" workspace />
    </StaffWorkspaceShell>
  );
}

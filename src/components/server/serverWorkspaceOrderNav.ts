import type { StaffWorkspaceNavItem } from '@/components/design-system/StaffWorkspaceShell';

type Translate = (key: string, fallback: string) => string;

export function serverOrderNavItem(enabled: boolean, t: Translate): StaffWorkspaceNavItem[] {
  if (!enabled) return [];
  return [{ href: '/server/orders', label: t('serverOrders.title', 'Orders') }];
}

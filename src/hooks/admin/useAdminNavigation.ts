import { useEffect, useMemo, useState } from 'react';
import { moduleForPath, type ModuleId } from '@/lib/modules';
import {
  adminNavItems,
  adminNavigationGroups,
  isAdminNavActive,
  type AdminNavGroupId,
} from '@/components/admin/adminNavigation';

export function useAdminNavigation(pathname: string, modules: ReadonlySet<ModuleId>, role: string | undefined) {
  const visible = useMemo(
    () =>
      adminNavItems.filter((item) => {
        if (item.adminOnly && role !== 'Admin') return false;
        const moduleId = moduleForPath(item.href);
        return moduleId === null || modules.has(moduleId);
      }),
    [modules, role],
  );
  const groups = useMemo(() => adminNavigationGroups(visible), [visible]);
  const activeGroup = groups.find((group) => group.items.some((item) => isAdminNavActive(pathname, item.href)))?.id;
  const [expanded, setExpanded] = useState<AdminNavGroupId[]>([activeGroup ?? 'menu']);
  useEffect(() => {
    if (activeGroup) setExpanded((current) => (current.includes(activeGroup) ? current : [...current, activeGroup]));
  }, [activeGroup]);
  const toggle = (id: AdminNavGroupId) =>
    setExpanded((current) => (current.includes(id) ? current.filter((group) => group !== id) : [...current, id]));
  return { groups, dashboard: visible.find((item) => item.href === '/admin/dashboard'), expanded, toggle };
}

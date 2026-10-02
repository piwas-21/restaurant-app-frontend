'use client';

import React, { useEffect, useState } from 'react';
import Link from '@/components/TenantLink';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { isAdminNavActive, type AdminNavItem } from './adminNavigation';
import { useAdminNavigation } from '@/hooks/admin/useAdminNavigation';
import groupStyles from './SidebarGroups.module.css';
import styles from '@/app/styles/AdminPage.module.css';
import { useModules } from '@/contexts/ModulesContext';
import { useAuth } from '@/components/AuthContext';
import { appPathname } from '@/lib/tenantLocaleRouting';
import { tenantLocaleHref } from '@/lib/tenantLocaleNavigation';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: Readonly<SidebarProps>) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const routePath = appPathname(pathname);
  const modules = useModules();
  const { user } = useAuth();
  const [isClient, setIsClient] = useState(false);

  // Ensure we're on client side and language is loaded
  useEffect(() => {
    setIsClient(true);
  }, []);

  const { groups, dashboard, expanded, toggle } = useAdminNavigation(routePath, modules, user?.role);
  const groupLabels = {
    menu: isClient ? t('adminNavigation.menu', 'Menu & sales') : 'Menu & sales',
    operations: isClient ? t('adminNavigation.operations', 'Orders & service') : 'Orders & service',
    customers: isClient ? t('adminNavigation.customers', 'Customers') : 'Customers',
    settings: isClient ? t('adminNavigation.settings', 'Settings') : 'Settings',
  };
  const renderLink = (item: AdminNavItem) => {
    const Icon = item.icon;
    const label = isClient ? t(item.key, item.fallback) : item.fallback;
    return (
      <li key={item.href}>
        <Link
          href={tenantLocaleHref(pathname, item.href)}
          className={isAdminNavActive(routePath, item.href) ? styles.activeLink : ''}
          aria-current={isAdminNavActive(routePath, item.href) ? 'page' : undefined}
          onClick={onClose}
        >
          <Icon size={20} strokeWidth={2} aria-hidden="true" />
          <span suppressHydrationWarning>{label}</span>
        </Link>
      </li>
    );
  };

  return (
    <aside
      className={`${styles.sidebar} ${isOpen ? 'open' : ''}`}
      data-open={isOpen}
      style={{
        zIndex: 2002,
        transform: isOpen ? 'translateX(0)' : undefined,
      }}
    >
      {/* The wrapper is what STICKS on desktop (AdminPage.module.css `.sidebarSticky`). The aside
          around it stays stretched so its dark column reaches the foot of the page; a sticky aside
          would be one viewport tall and leave a light strip below itself on any longer page. */}
      <div className={styles.sidebarSticky}>
        <div className={styles.sidebarTitle} suppressHydrationWarning>
          {isClient ? t('admin_dashboard_title') : 'Admin Dashboard'}
        </div>
        <hr className={styles.sidebarDivider} />
        <nav aria-label={isClient ? t('adminNavigation.label', 'Administration') : 'Administration'}>
          <ul>
            {dashboard && renderLink(dashboard)}
            {groups.map((group) => (
              <li key={group.id} className={groupStyles.group}>
                <button
                  type="button"
                  className={groupStyles.toggle}
                  aria-expanded={expanded.includes(group.id)}
                  aria-controls={`admin-nav-${group.id}`}
                  onClick={() => toggle(group.id)}
                >
                  {groupLabels[group.id]}
                  <ChevronDown size={18} aria-hidden="true" />
                </button>
                <ul id={`admin-nav-${group.id}`} hidden={!expanded.includes(group.id)}>
                  {group.items.map(renderLink)}
                </ul>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}

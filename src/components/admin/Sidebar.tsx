'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Users,
  FolderTree,
  UtensilsCrossed,
  Sparkles,
  Award,
  Gift,
  TrendingUp,
  ClipboardList,
  CalendarCheck,
  ListChecks,
  MapPin,
  BarChart3,
  Settings,
  UserCog,
  LayoutDashboard,
  ImageDown,
  KeyRound,
  type LucideIcon,
} from 'lucide-react';
import styles from '@/app/styles/AdminPage.module.css';
import { moduleForPath } from '@/lib/modules';
import { useModules } from '@/contexts/ModulesContext';
import { useAuth } from '@/components/AuthContext';

interface NavItem {
  href: string;
  key: string;
  fallback: string;
  icon: LucideIcon;
  /** Hidden from Staff sessions — the surface behind it is Admin-only server-side. */
  adminOnly?: boolean;
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar = ({ isOpen = true, onClose }: SidebarProps) => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const modules = useModules();
  const { user } = useAuth();
  const [isClient, setIsClient] = useState(false);

  // Ensure we're on client side and language is loaded
  useEffect(() => {
    setIsClient(true);
  }, []);

  const navItems: NavItem[] = [
    {
      href: '/admin/dashboard',
      key: 'admin_dashboard_title',
      fallback: 'Admin Dashboard',
      icon: LayoutDashboard,
    },
    {
      href: '/admin/member-management',
      key: 'admin_member_management_title',
      fallback: 'Member Management',
      icon: Users,
    },
    {
      href: '/admin/user-groups',
      key: 'admin_user_groups_title',
      fallback: 'User Groups',
      icon: UserCog,
    },
    {
      href: '/admin/category-management',
      key: 'admin_category_management_title',
      fallback: 'Category Management',
      icon: FolderTree,
    },
    {
      href: '/admin/menu-management',
      key: 'admin_menu_management_title',
      fallback: 'Menu Management',
      icon: UtensilsCrossed,
    },
    {
      href: '/admin/specials-management',
      key: 'admin_specials_management_title',
      fallback: 'Specials Management',
      icon: Sparkles,
    },
    {
      href: '/admin/orders-management',
      key: 'admin_orders_management_title',
      fallback: 'Orders Management',
      icon: ClipboardList,
    },
    {
      href: '/admin/restaurant-settings',
      key: 'restaurant_settings',
      fallback: 'Restaurant Settings',
      icon: Settings,
    },
    {
      href: '/admin/customer-forms',
      key: 'admin_customer_forms_title',
      fallback: 'Customer Forms',
      icon: ListChecks,
    },
    {
      href: '/admin/reservations-management',
      key: 'admin_reservations_management',
      fallback: 'Reservations Management',
      icon: CalendarCheck,
    },
    {
      href: '/admin/table-layout-editor',
      key: 'table_layout_editor',
      fallback: 'Table Layout',
      icon: MapPin,
    },
    {
      href: '/admin/table-statistics',
      key: 'table_statistics',
      fallback: 'Table Statistics',
      icon: BarChart3,
    },
    {
      href: '/admin/point-rules',
      key: 'point_rules',
      fallback: 'Point Rules',
      icon: Award,
    },
    {
      href: '/admin/customer-discounts',
      key: 'customer_discounts',
      fallback: 'Customer Discounts',
      icon: Gift,
    },
    {
      href: '/admin/fidelity-analytics',
      key: 'fidelity_analytics',
      fallback: 'Fidelity Analytics',
      icon: TrendingUp,
    },
    {
      // Not module-gated: the backend guards it on the Admin role alone, so `moduleForPath`
      // returns null and it stays visible for every tenant. Adding a module entry would hide
      // a maintenance surface from tenants who simply bought a different bundle.
      href: '/admin/image-backfill',
      key: 'admin_image_backfill_title',
      fallback: 'Image Backfill',
      icon: ImageDown,
    },
    {
      // Admin-ONLY, unlike every other entry above: the three `/api/ApiTokens` endpoints refuse a
      // Staff JWT (API-TOKENS-PLAN §8), so a Staff member following this link would meet three
      // 403s and an empty page. Not module-gated — a token is a platform credential, not a
      // purchasable feature.
      href: '/admin/api-tokens',
      key: 'admin_api_tokens_title',
      fallback: 'API Tokens',
      icon: KeyRound,
      adminOnly: true,
    },
  ];

  // Drop the entries whose module this tenant did not buy (sofra ADR-010 / S11). Derived
  // from the SAME route map ModuleRouteGuard uses, so the nav and the guard cannot disagree
  // — an item that survives here always leads somewhere that renders.
  const visibleItems = navItems.filter((item) => {
    if (item.adminOnly && user?.role !== 'Admin') return false;
    const moduleId = moduleForPath(item.href);
    return moduleId === null || modules.has(moduleId);
  });

  return (
    <aside
      className={`${styles.sidebar} ${isOpen ? 'open' : ''}`}
      data-open={isOpen}
      style={{
        zIndex: 2002,
        transform: isOpen ? 'translateX(0)' : undefined,
      }}
    >
      <div className={styles.sidebarTitle} suppressHydrationWarning>
        {isClient ? t('admin_dashboard_title') : 'Admin Dashboard'}
      </div>
      <hr className={styles.sidebarDivider} />
      <nav>
        <ul>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const label = isClient ? t(item.key, item.fallback || item.key) : item.fallback || item.key;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={pathname.startsWith(item.href) ? styles.activeLink : ''}
                  onClick={onClose}
                >
                  <Icon size={20} strokeWidth={2} />
                  <span suppressHydrationWarning>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;

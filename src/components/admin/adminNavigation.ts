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
  Languages,
  Store,
  type LucideIcon,
} from 'lucide-react';

export interface AdminNavItem {
  readonly href: string;
  readonly key: string;
  readonly fallback: string;
  readonly icon: LucideIcon;
  readonly adminOnly?: boolean;
}
export type AdminNavGroupId = 'menu' | 'operations' | 'customers' | 'settings';
export interface AdminNavGroup {
  readonly id: AdminNavGroupId;
  readonly items: readonly AdminNavItem[];
}

export const adminNavItems: readonly AdminNavItem[] = [
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
    // Same admin-only surface family as the catalog it edits: the bulk-apply endpoint writes
    // across every product, so it is guarded server-side on the Admin role alone. Not
    // module-gated (no entry owns it, mirroring menu-management itself, which is core).
    href: '/admin/ingredient-translations',
    key: 'admin_ingredient_translations_title',
    fallback: 'Ingredients & Sauces',
    icon: Languages,
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
  {
    href: '/admin/delivery-channels',
    key: 'deliveryChannels.navLabel',
    fallback: 'Delivery channels',
    icon: Store,
    adminOnly: true,
  },
];

const groupPaths: Readonly<Record<AdminNavGroupId, readonly string[]>> = {
  menu: [
    'menu-management',
    'category-management',
    'ingredient-translations',
    'specials-management',
    'delivery-channels',
  ],
  operations: ['orders-management', 'reservations-management', 'table-layout-editor', 'table-statistics'],
  customers: [
    'member-management',
    'user-groups',
    'customer-forms',
    'point-rules',
    'customer-discounts',
    'fidelity-analytics',
  ],
  settings: ['restaurant-settings', 'api-tokens', 'image-backfill'],
};
export function adminNavigationGroups(items: readonly AdminNavItem[]): AdminNavGroup[] {
  return (Object.keys(groupPaths) as AdminNavGroupId[])
    .map((id) => ({
      id,
      items: groupPaths[id].flatMap((path) => items.filter((item) => item.href === `/admin/${path}`)),
    }))
    .filter((group) => group.items.length > 0);
}
export function isAdminNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

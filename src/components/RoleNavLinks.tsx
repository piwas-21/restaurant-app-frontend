'use client';

// Role-based customer nav links (ADR-006, S15 T3 slice 2) — extracted
// VERBATIM from app-internal-layout.tsx's renderNavLinks() so both tenant
// templates' customer chromes share one source of truth for routes, i18n
// keys, icons, role rules and the cart badge. Rendering is byte-identical
// to the original inline function (same JSX; `closeMobileMenu` became the
// `onNavigate` prop; the hooks it read now live here).
//
// Styling stays with the consumer: links use the global `nav-link` class
// (globals.css) driven by the `--nav-link-*` variables, so a template
// re-skins them via tokens/vars, never by forking this component.
// NOTE: app-internal-layout.tsx (the shared staff/admin chrome) still
// carries the original inline copy — it is deliberately untouched in this
// slice (zero-delta beats DRY there; consolidation is T4 polish work).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Home, UtensilsCrossed, CalendarCheck, ShoppingCart, LayoutDashboard, Receipt } from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { useCart } from '@/components/cart/CartContext';
import navStyles from '@/app/styles/Header.module.css';

interface RoleNavLinksProps {
  /** Called on every link click (the chromes close their mobile menu). */
  onNavigate: () => void;
}

export default function RoleNavLinks({ onNavigate }: RoleNavLinksProps) {
  const { user, isLoading } = useAuth();
  const { state: cartState } = useCart();
  const pathname = usePathname();
  const { t } = useTranslation();

  // Calculate total cart items
  const cartItemCount = cartState.items.reduce((total, item) => total + item.quantity, 0);

  if (isLoading) return null;
  const role = user?.role.toLowerCase();

  // Cashier: Show only Cashier link
  if (role === 'cashier') {
    return (
      <>
        <Link href="/cashier" className={`nav-link ${pathname === '/cashier' ? 'active' : ''}`} onClick={onNavigate}>
          <Receipt size={18} />
          <span>{t('nav_cashier', 'Cashier')}</span>
        </Link>
      </>
    );
  }

  // Server: Show only Server link
  if (role === 'server') {
    return (
      <>
        <Link href="/server" className={`nav-link ${pathname === '/server' ? 'active' : ''}`} onClick={onNavigate}>
          <UtensilsCrossed size={18} />
          <span>{t('nav_server', 'Server')}</span>
        </Link>
      </>
    );
  }

  // Admin: Show all customer links + admin dashboard
  if (role === 'admin') {
    return (
      <>
        <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`} onClick={onNavigate}>
          <Home size={18} />
          <span>{t('nav_home', 'Home')}</span>
        </Link>
        <Link href="/menu" className={`nav-link ${pathname === '/menu' ? 'active' : ''}`} onClick={onNavigate}>
          <UtensilsCrossed size={18} />
          <span>{t('nav_menu', 'Menu')}</span>
        </Link>
        <Link
          href="/reservations"
          className={`nav-link ${pathname === '/reservations' ? 'active' : ''}`}
          onClick={onNavigate}
        >
          <CalendarCheck size={18} />
          <span>{t('nav_reservations', 'Reservations')}</span>
        </Link>
        <Link href="/cart" className={`nav-link ${pathname === '/cart' ? 'active' : ''}`} onClick={onNavigate}>
          <ShoppingCart size={18} />
          <span>{t('nav_cart', 'Cart')}</span>
          {cartItemCount > 0 && <span className={navStyles.cartBadge}>{cartItemCount}</span>}
        </Link>
        <Link
          href="/admin/dashboard"
          className={`nav-link ${pathname.startsWith('/admin') ? 'active' : ''}`}
          onClick={onNavigate}
        >
          <LayoutDashboard size={18} />
          <span>{t('admin_dashboard_title')}</span>
        </Link>
      </>
    );
  }

  // Regular users: Show customer navigation
  return (
    <>
      <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`} onClick={onNavigate}>
        <Home size={18} />
        <span>{t('nav_home', 'Home')}</span>
      </Link>
      <Link href="/menu" className={`nav-link ${pathname === '/menu' ? 'active' : ''}`} onClick={onNavigate}>
        <UtensilsCrossed size={18} />
        <span>{t('nav_menu', 'Menu')}</span>
      </Link>
      <Link
        href="/reservations"
        className={`nav-link ${pathname === '/reservations' ? 'active' : ''}`}
        onClick={onNavigate}
      >
        <CalendarCheck size={18} />
        <span>{t('nav_reservations', 'Reservations')}</span>
      </Link>
      <Link href="/cart" className={`nav-link ${pathname === '/cart' ? 'active' : ''}`} onClick={onNavigate}>
        <ShoppingCart size={18} />
        <span>{t('nav_cart', 'Cart')}</span>
        {cartItemCount > 0 && <span className={navStyles.cartBadge}>{cartItemCount}</span>}
      </Link>
    </>
  );
}

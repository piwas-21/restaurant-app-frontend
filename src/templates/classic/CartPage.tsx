'use client';

// classic CartPage (ADR-006 — cart surface). The original RUMI /cart page,
// relocated from src/app/cart/page.tsx behind the `@active-template/CartPage`
// re-export. The whole orchestration is the shared CartPageLayout (also used
// by craft); this file only supplies the classic CSS module for every area,
// so the rendered DOM is unchanged.
import CartPageLayout from '@/components/cart/cart-page/CartPageLayout';
import styles from '@/app/styles/CartPage.module.css';

export default function CartPage() {
  return <CartPageLayout styles={{ page: styles, item: styles, summary: styles }} />;
}

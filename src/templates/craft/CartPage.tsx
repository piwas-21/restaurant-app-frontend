'use client';

// craft /cart — the kitchen order-pad page (craft-stitch-prompts Prompt 5's
// full-page design, brought to the standalone route in the 2026-07-22
// consistency pass; the menu-rail/sheet variant is CraftCartContents). The
// whole orchestration is the shared CartPageLayout; this file only supplies
// the craft modules: an order-pad plate for the items (Amatic dish names,
// dashed page rules, kraft steppers), a kraft totals panel with a tape-label
// promo code, and letterpress terracotta CTAs from the primitives layer.
import CartPageLayout from '@/components/cart/cart-page/CartPageLayout';
import page from './cart/CartPage.module.css';
import row from './cart/CartItemRow.module.css';
import notes from './cart/CartItemNotes.module.css';
import summary from './cart/CartSummary.module.css';

// Row + notes are one logical module split for the 200-LOC limit; the shared
// bodies expect a single `item` styles object.
const item = { ...row, ...notes };

export default function CartPage() {
  return <CartPageLayout styles={{ page, item, summary }} />;
}

'use client';

import ItemCustomizationSheet from '@/components/menu/ItemCustomizationSheet';
import CartSheet from '@/components/order/CartSheet';
import OrderFlowModals from '@/components/order/OrderFlowModals';
import { useCatalogSheet } from '@/hooks/menu/useCatalogSheet';
import { useMenuCart } from '@/hooks/menu/useMenuCart';
import { useOrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';
import type { OrderType } from '@/types/order';

type CatalogSheetController = ReturnType<typeof useCatalogSheet>;
type CartController = ReturnType<typeof useMenuCart>;
type FollowUpController = ReturnType<typeof useOrderTypeFollowUp>;

interface MenuOrderOverlaysProps {
  /** The page's one sheet pair — the grids and the featured banner both open it. */
  sheet: CatalogSheetController;
  /** The basket: the slide-over reads its open state and close handler. */
  cart: CartController;
  /** The order-type follow-up — the sheet's own switch lands here to open its confirm. */
  followUp: FollowUpController;
  /** Same switch handler the cards take, for the sheet's blocked-add way out (§9.10). */
  onSwitchOrderType: (type: OrderType) => void;
}

/**
 * The order surfaces stacked over BOTH menu layouts (tabs and one-page render the same
 * browsing body, and the sheet/pair-hosting rules below belong to neither of them):
 * the two customization sheets (one product, one bundle), the basket slide-over, and
 * the follow-up modals.
 */
export default function MenuOrderOverlays({
  sheet,
  cart,
  followUp,
  onSwitchOrderType,
}: Readonly<MenuOrderOverlaysProps>) {
  return (
    <>
      {/* Same switch handler as the cards: the sheet refuses an add the card refused (§9.10), and
          the way out has to reach the page's follow-up instance to open its modal. */}
      <ItemCustomizationSheet controller={sheet.product} onSwitchOrderType={onSwitchOrderType} drinks={sheet.drinks} />
      <ItemCustomizationSheet controller={sheet.bundle} onSwitchOrderType={onSwitchOrderType} drinks={sheet.drinks} />

      {/* Closed while an order-type conflict is being confirmed. The sheet hosts the very toggle
          that raises the confirm, so leaving it open stacks two BaseModals — and both register a
          GLOBAL window keydown, so one Escape dismisses both. Same rule §9.10 landed for the
          customization sheet: the surface that hands a verdict over closes behind it. */}
      <CartSheet
        isOpen={cart.isSheetOpen && followUp.switchFlow.pending === null}
        onClose={cart.closeSheet}
        followUp={followUp}
      />

      <OrderFlowModals followUp={followUp} />
    </>
  );
}

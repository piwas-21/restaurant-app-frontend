'use client';

import { formatPlainCurrency } from '@/utils/currency';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogItem } from '@/types/menu';
import type { OrderType } from '@/types/order';
import type { OpenSheetOptions } from '@/hooks/menu/sheetOptions';
import { isItemBlocked, useItemAvailabilityNotice } from '@/hooks/menu/useItemAvailabilityNotice';
import { useTrackItemBlocked } from '@/hooks/menu/useTrackItemBlocked';
import { FALLBACK_IMAGE } from '@/utils/imageHelpers';
import MenuCardImage from './MenuCardImage';
import MenuCardAvailability from './MenuCardAvailability';
import MenuItemDetails from './MenuItemDetails';
import AddToOrderButton from './AddToOrderButton';
import OrderTypeRibbon from './OrderTypeRibbon';
import AdminMenuCardControls from './AdminMenuCardControls';
import AdminPriceEditor from './AdminPriceEditor';
import styles from './MenuItem.module.css';
// The admin editor's mark on its HOST card (the editing ring). Its own module, not a section of
// `MenuItem.module.css`: that file is at the §4 ceiling, and the class styles the CARD on the admin
// control's behalf rather than the customer card's own chrome.
import adminPriceStyles from './AdminPriceEditorHost.module.css';
// The classic card's own availability styling, split out of `MenuItem.module.css` (200-LOC limit).
// Still the HOST's stylesheet — `MenuCardAvailability` is the shared shell and takes whichever
// module its host hands it; craft passes its own. The shell reads only `availability*` classes.
import availabilityStyles from './MenuItemAvailability.module.css';

export interface MenuCardProps {
  item: CatalogItem;
  /**
   * Open the customization sheet. `opts.forceSheet` (Details/title) always opens it to view the
   * item; without it (Add to Order) a simple product adds straight to the cart.
   */
  onOpen: (item: CatalogItem, opts?: OpenSheetOptions) => void;
  /**
   * Called when a guest submits dish feedback. Currently never fired: the feedback FORM used to
   * render here behind `showFeedbackForm`, and its only trigger — a button in the old
   * `MenuItemActions` — has been commented out since before that component was retired, so the
   * state could not be set by anything. The dead form is gone; the prop stays because `MenuList`
   * threads it and the feature is still intended.
   */
  onFeedbackSuccess: (dishId: string) => void;
  /**
   * Commit a different order type from the card's "Switch to X" affordance. Drilled from the page
   * because it must be the page's `useOrderTypeFollowUp` instance — that hook owns the follow-up
   * modal STATE, and `OrderFlowModals` renders from the page's instance, so a card that called the
   * hook itself would set the type and then silently swallow the table / address / contact step.
   */
  onSwitchOrderType?: (type: OrderType) => void;
}

/**
 * The single customer catalog card (menu-bundles redesign #175, slice 6). Renders a plain product
 * and a combo from one `CatalogItem` view-model.
 *
 * Layout follows `stitch_classic_restaurant_design_system` (desktop grid card) and
 * `mobile_menu_light` (the ≤600px list row): photo, then a title row carrying the dish name against
 * its allergen glyphs and price, then two lines of description ending in the Details link, then one
 * full-width action. The price used to sit in a separate foot row beside the button — two objects
 * competing for the eye at the bottom of every card, and the reason the card's own foot needed a
 * hairline to look closed.
 *
 * The title and Details affordances open the shared `ItemCustomizationSheet` to VIEW the item
 * (`forceSheet`); Add to Order opens the same sheet to customize, but a simple product with nothing
 * to choose adds straight to the cart. Clicking the image opens the gallery (`MenuCardImage`).
 */
export default function MenuCard({
  item,
  onOpen,
  onFeedbackSuccess: _onFeedbackSuccess,
  onSwitchOrderType,
}: Readonly<MenuCardProps>) {
  const { t, i18n } = useTranslation();
  const availabilityNotice = useItemAvailabilityNotice(item.availability);
  useTrackItemBlocked(item.id, availabilityNotice);
  const isBlocked = isItemBlocked(item.availability, availabilityNotice);
  const nameId = `item-name-${item.id}`;
  const reasonId = `item-availability-${item.id}`;
  const specialId = `item-special-${item.id}`;
  const [imageFailed, setImageFailed] = useState(false);
  // Locally reflect an admin inline price edit; resync if the item prop changes.
  const [price, setPrice] = useState(item.price);
  useEffect(() => setPrice(item.price), [item.price]);
  // Whether this card's price is open in the admin editor, so the CARD can say so rather than
  // leaving it to one 200px row. Always false for a guest — the editor owns the condition.
  const [priceEditing, setPriceEditing] = useState(false);

  const currentLanguage = (i18n.language || 'en').split('-')[0];
  const itemName = item.content?.[currentLanguage]?.name || item.content?.en?.name || item.name;
  const description = item.content?.[currentLanguage]?.description || item.content?.en?.description || item.description;

  // A combo's default picks ("Pizza + Cola") — the one thing the retired MenuBundleCard rendered
  // that MenuItemDetails still does not.
  const bundleIncludes = item.isBundle ? (item.bundleItemNames ?? []).join(' + ') : '';

  // Add to Order: a simple product adds straight to the cart. Details/title: always open the sheet
  // to view the item (never silently add it).
  const open = () => onOpen(item);
  const openDetails = () => onOpen(item, { forceSheet: true });

  return (
    // A blocked card stays in the list and every control inside it stays focusable; the reason id is
    // appended to the accessible name, so a screen reader hears "Dürüm … Takeaway and Delivery only"
    // rather than an unexplained dim card, which is the sighted-user equivalent of the visual dim.
    //
    // §4.4 also asked for `aria-disabled` here. It is deliberately NOT set: a list item is not an
    // interactive element, and this card has no inert control for the state to describe — "Add to
    // order" is REMOVED while blocked rather than left disabled-and-unexplained.
    <li
      // Addressable as a CARD, distinct from the Chef's Special hero that now shares this grid.
      // E2E-STRATEGY prefers role+name, and role+name cannot separate them here: when the promoted
      // dish is also in the catalogue (which is exactly the seeded fixture's case) both its hero and
      // its card offer a button named "Add <dish> to order", and both sit inside
      // `data-testid="menu-grid"`.
      data-testid="menu-card"
      className={[
        styles.menuItem,
        isBlocked ? styles.blocked : null,
        priceEditing ? adminPriceStyles.hostEditing : null,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={[item.isSpecial ? specialId : null, nameId, isBlocked ? reasonId : null]
        .filter(Boolean)
        .join(' ')}
    >
      <AdminMenuCardControls item={item} />

      {/* The diagonal corner band. Only while BLOCKED — an `info` notice ("also available for
          delivery") is not a restriction on what the guest is doing now, and a ribbon on every card
          would say nothing. It is rendered against the <li>, outside the photo, so it wraps the
          card's own corner at both breakpoints. */}
      {isBlocked && availabilityNotice && <OrderTypeRibbon label={availabilityNotice.message} />}

      <MenuCardImage
        imageUrl={imageFailed ? FALLBACK_IMAGE : (item.imageUrl ?? FALLBACK_IMAGE)}
        alt={itemName || t('menu_item_image_alt')}
        images={item.images}
        imageCount={item.imageCount}
        countLabel={t('images_count_label')}
        enlargeLabel={t('menu_item_image_enlarge_aria', 'Enlarge {{itemName}} image', { itemName })}
        // The ribbon belongs to the PHOTO, so it is handed to the image as a slot rather than
        // positioned against the <li>. Inside the enlarge button it is outside that button's
        // accessible name, so the id is folded into the card's `aria-labelledby` above.
        badge={
          item.isSpecial ? (
            <span id={specialId} className={styles.specialBadge} data-testid="special-badge">
              {t('special')}
            </span>
          ) : undefined
        }
        onError={() => setImageFailed(true)}
      />
      <div className={styles.contentWrapper}>
        <MenuItemDetails
          id={item.id}
          title={itemName}
          description={description ?? ''}
          allergens={item.allergens}
          dietaryTags={item.dietaryTags ?? []}
          t={t}
          priceSlot={
            <>
              <span
                className={styles.rowPrice}
                aria-label={`${t('checkout_total_label')} ${formatPlainCurrency(price)}`}
              >
                {formatPlainCurrency(price)}
              </span>
              {/* `setPriceEditing` is passed bare, not wrapped: `onEditingChange` fires from an
                  effect keyed on that boolean, and a useState setter is the referentially stable
                  identity the contract needs. An inline arrow would re-fire it on every render. */}
              <AdminPriceEditor item={item} onPriceChange={setPrice} onEditingChange={setPriceEditing} />
            </>
          }
          onTitleClick={openDetails}
          onDetailsClick={openDetails}
          detailsLabel={t('details')}
          detailsAria={t('menu_item_details_aria', { itemName })}
        />

        {item.isBundle && bundleIncludes && (
          /* product-authored text: dir="auto" (DESIGN-SYSTEM.md §8.2) */
          <p dir="auto" className={styles.bundleIncludes}>
            {bundleIncludes}
          </p>
        )}

        {availabilityNotice && (
          <MenuCardAvailability
            notice={availabilityNotice}
            reasonId={reasonId}
            onSwitchOrderType={onSwitchOrderType}
            styles={availabilityStyles}
          />
        )}

        {/* REMOVED, not disabled, while blocked: a disabled control fires no click and explains
            nothing, while the switch inside the notice above is the way out. The card's Details
            affordance stays live so the guest can still read the dish. */}
        {!isBlocked && (
          <AddToOrderButton
            onAdd={open}
            label={t('add_to_order')}
            ariaLabel={t('add_item_to_order', { itemName })}
            variant="outline"
            shape="card"
          />
        )}
      </div>
    </li>
  );
}

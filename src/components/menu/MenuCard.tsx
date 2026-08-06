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
import MenuItemActions from './MenuItemActions';
import AdminMenuCardControls from './AdminMenuCardControls';
import AdminPriceEditor from './AdminPriceEditor';
import FeedbackForm from '@/components/feedback/FeedbackForm';
import styles from './MenuItem.module.css';
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
 * and a combo from one `CatalogItem` view-model, replacing the `MenuItem` + `MenuBundleCard` fork.
 * The title and Details affordances open the shared `ItemCustomizationSheet` to VIEW the item
 * (`forceSheet` — it shows ingredients, allergens, prep time, variations and, for a combo, its
 * sections, and lets the guest act on it). Add to Order opens the same sheet to customize, but a
 * simple product with nothing to choose adds straight to the cart. Clicking the image opens the
 * enlarge-on-click gallery (`MenuCardImage`).
 */
export default function MenuCard({ item, onOpen, onFeedbackSuccess, onSwitchOrderType }: Readonly<MenuCardProps>) {
  const { t, i18n } = useTranslation();
  const availabilityNotice = useItemAvailabilityNotice(item.availability);
  useTrackItemBlocked(item.id, availabilityNotice);
  const isBlocked = isItemBlocked(item.availability, availabilityNotice);
  const nameId = `item-name-${item.id}`;
  const reasonId = `item-availability-${item.id}`;
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  // Locally reflect an admin inline price edit; resync if the item prop changes.
  const [price, setPrice] = useState(item.price);
  useEffect(() => setPrice(item.price), [item.price]);

  const currentLanguage = (i18n.language || 'en').split('-')[0];
  const itemName = item.content?.[currentLanguage]?.name || item.content?.en?.name || item.name;
  const description = item.content?.[currentLanguage]?.description || item.content?.en?.description || item.description;

  // A combo's default picks ("Pizza + Cola") — the one thing the retired MenuBundleCard rendered
  // that MenuItemDetails still does not. Its DESCRIPTION used to be in the same boat and no longer
  // is: MenuItemDetails renders that for both kinds now, so only this line is rendered here.
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
    // order" is REMOVED while blocked rather than left disabled-and-unexplained, so there is nothing
    // an AT could act on. Setting it anyway is markup `jsx-a11y/role-supports-aria-props` rejects.
    <li
      className={isBlocked ? `${styles.menuItem} ${styles.blocked}` : styles.menuItem}
      aria-labelledby={isBlocked ? `${nameId} ${reasonId}` : nameId}
    >
      {item.isSpecial && (
        <div className={styles.specialBadge} data-testid="special-badge">
          {t('special')}
        </div>
      )}

      <AdminMenuCardControls item={item} />

      <MenuCardImage
        imageUrl={imageFailed ? FALLBACK_IMAGE : (item.imageUrl ?? FALLBACK_IMAGE)}
        alt={itemName || t('menu_item_image_alt')}
        images={item.images}
        imageCount={item.imageCount}
        countLabel={t('images_count_label')}
        enlargeLabel={t('menu_item_image_enlarge_aria', 'Enlarge {{itemName}} image', { itemName })}
        onError={() => setImageFailed(true)}
      />
      <div className={styles.contentWrapper}>
        <MenuItemDetails
          id={item.id}
          title={itemName}
          description={description ?? ''}
          // Dormant in MenuItemDetails today, but kept fed so a product still summarises correctly
          // whenever that block is uncommented.
          ingredients={resolveIngredientSummary(item, currentLanguage)}
          allergens={item.allergens}
          dietaryTags={item.dietaryTags ?? []}
          t={t}
          onTitleClick={openDetails}
          // The card's Details affordance, on the description block rather than as a second
          // full-size button beside Add to Order.
          onDetailsClick={openDetails}
          detailsLabel={t('details')}
          detailsAria={t('menu_item_details_aria', { itemName })}
          initialRatingData={{ average: 0, count: 0 }}
        />

        {/* Only the default picks. The description used to be rendered here too, because
            `MenuItemDetails` had its own copy commented out and a combo would otherwise have lost
            it; that block is live again, so keeping this one would print the sentence twice. */}
        {item.isBundle && bundleIncludes && (
          <div className={styles.bundleSummary}>
            {/* product-authored text: dir="auto" (DESIGN-SYSTEM.md §8.2) */}
            <p dir="auto" className={styles.bundleIncludes}>
              {bundleIncludes}
            </p>
          </div>
        )}

        {availabilityNotice && (
          <MenuCardAvailability
            notice={availabilityNotice}
            reasonId={reasonId}
            onSwitchOrderType={onSwitchOrderType}
            styles={availabilityStyles}
          />
        )}

        {/* One row, one price, at every viewport — the card used to carry two price nodes with
            only CSS deciding which was showing (`.itemPrice` in MenuItemDetails above 600px,
            `.mobilePrice` here below it). The admin editor rides in the same row, beside the
            price it edits. */}
        <div className={styles.priceActionsRow}>
          <span className={styles.rowPrice} aria-label={`${t('checkout_total_label')} ${formatPlainCurrency(price)}`}>
            {formatPlainCurrency(price)}
          </span>
          <AdminPriceEditor item={item} onPriceChange={setPrice} />
          <MenuItemActions
            onAdd={open}
            onFeedback={() => setShowFeedbackForm(true)}
            addAria={t('add_item_to_order', { itemName })}
            addLabel={t('add_to_order')}
            showAdd={!isBlocked}
            feedbackAria={`${t('feedback_form_heading')} ${itemName}`}
            feedbackLabel={t('feedback_form_heading')}
          />
        </div>
      </div>
      {/* Feedback is a dish-level feature, so a combo never offers it. Currently unreachable either
          way: `MenuItemActions` keeps its feedback button commented out until the feature lands. */}
      {showFeedbackForm && !item.isBundle && (
        <FeedbackForm dishId={item.id} onSubmitSuccess={() => onFeedbackSuccess(item.id)} />
      )}
    </li>
  );
}

/** The localized ingredient list, falling back to the API's plain-string array. */
function resolveIngredientSummary(item: CatalogItem, language: string): string {
  const active = item.detailedIngredients?.filter((ing) => ing.isActive) ?? [];
  if (active.length > 0) {
    return active.map((ing) => ing.content?.[language]?.name || ing.content?.en?.name || ing.name).join(', ');
  }
  return item.ingredients?.join(', ') ?? '';
}

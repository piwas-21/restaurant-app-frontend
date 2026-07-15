'use client';

import { formatPlainCurrency } from '@/utils/currency';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogItem } from '@/types/menu';
import { FALLBACK_IMAGE } from '@/utils/imageHelpers';
import MenuItemImage from './MenuItemImage';
import MenuItemDetails from './MenuItemDetails';
import MenuItemActions from './MenuItemActions';
import FeedbackForm from '@/components/feedback/FeedbackForm';
import styles from './MenuItem.module.css';

interface MenuCardProps {
  item: CatalogItem;
  /** Open the customization sheet — the one surface for both adding and viewing details. */
  onOpen: (item: CatalogItem) => void;
  onFeedbackSuccess: (dishId: string) => void;
}

/**
 * The single customer catalog card (menu-bundles redesign #175, slice 6). Renders a plain product
 * and a combo from one `CatalogItem` view-model, replacing the `MenuItem` + `MenuBundleCard` fork.
 * Both the Add and the Details affordances open the shared `ItemCustomizationSheet`: it shows
 * everything the old read-only details modals did (ingredients, allergens, prep time, variations
 * and, for a combo, its sections) and lets the guest act on it, so there is no separate details
 * surface to keep in sync.
 */
export default function MenuCard({ item, onOpen, onFeedbackSuccess }: Readonly<MenuCardProps>) {
  const { t, i18n } = useTranslation();
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const currentLanguage = (i18n.language || 'en').split('-')[0];
  const itemName = item.content?.[currentLanguage]?.name || item.content?.en?.name || item.name;
  const description = item.content?.[currentLanguage]?.description || item.content?.en?.description || item.description;

  // A combo's default picks ("Pizza + Cola") — the one thing the retired MenuBundleCard rendered
  // that MenuItemDetails does not. Its description is in the same boat: MenuItemDetails keeps both
  // its description and its ingredient blocks commented out until that feature lands, so a bundle
  // renders them here or loses them.
  const bundleIncludes = item.isBundle ? (item.bundleItemNames ?? []).join(' + ') : '';

  const open = () => onOpen(item);

  return (
    <div className={styles.menuItem} role="listitem" aria-labelledby={`item-name-${item.id}`}>
      {item.isSpecial && (
        <div className={styles.specialBadge} data-testid="special-badge">
          {t('special')}
        </div>
      )}

      <MenuItemImage
        imageUrl={imageFailed ? FALLBACK_IMAGE : (item.imageUrl ?? FALLBACK_IMAGE)}
        alt={itemName || t('menu_item_image_alt')}
        imageCount={item.imageCount}
        countLabel={t('images_count_label')}
        onClick={open}
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
          price={item.price}
          dietaryTags={item.dietaryTags ?? []}
          t={t}
          onTitleClick={open}
          initialRatingData={{ average: 0, count: 0 }}
        />

        {item.isBundle && (description || bundleIncludes) && (
          <div className={styles.bundleSummary}>
            {description && <p className={styles.bundleDescription}>{description}</p>}
            {bundleIncludes && <p className={styles.bundleIncludes}>{bundleIncludes}</p>}
          </div>
        )}

        <div className={styles.priceActionsRow}>
          <span className={styles.mobilePrice}>{formatPlainCurrency(item.price)}</span>
          <MenuItemActions
            onAdd={open}
            onFeedback={() => setShowFeedbackForm(true)}
            addAria={t('add_item_to_order', { itemName })}
            addLabel={t('add_to_order')}
            onDetails={open}
            detailsLabel={t('details')}
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
    </div>
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

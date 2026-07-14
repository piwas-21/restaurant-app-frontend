'use client';

import { formatPlainCurrency } from '@/utils/currency';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LanguageCode } from '@/components/LanguageSwitcher';
import type { MenuItem as MenuItemType } from '@/types/menu';
import MenuItemImage from './MenuItemImage';
import MenuItemDetails from './MenuItemDetails';
import MenuItemActions from './MenuItemActions';
import ProductDetailsModal from './ProductDetailsModal';
import FeedbackForm from '@/components/feedback/FeedbackForm';
import styles from './MenuItem.module.css';

interface MenuCardProps {
  item: MenuItemType;
  /** Open the customization sheet for this product (adds straight to cart when it has no options). */
  onAdd: (productId: string) => void;
  onFeedbackSuccess: (dishId: string) => void;
  getFallbackImage: (item: MenuItemType) => void;
}

/**
 * Customer catalog card (menu-bundles redesign #175, slice 6). Replaces `MenuItem`: the add path now
 * goes through the shared `ItemCustomizationSheet` (via `onAdd`) instead of a self-contained rogue
 * `fetch()` + `CustomizationModal`. The read-only details view still uses `ProductDetailsModal`.
 */
export default function MenuCard({ item, onAdd, onFeedbackSuccess, getFallbackImage }: Readonly<MenuCardProps>) {
  const { t, i18n } = useTranslation();
  const [showFeedbackForm, setShowFeedbackForm] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const currentLanguage = (i18n.language || 'en').split('-')[0] as LanguageCode;
  const itemName = item.content?.[currentLanguage]?.name || item.content?.en?.name || item.name;

  const getIngredientsText = (): string => {
    const active = item.detailedIngredients?.filter((ing) => ing.isActive) ?? [];
    if (active.length > 0) {
      return active.map((ing) => ing.content?.[currentLanguage]?.name || ing.content?.en?.name || ing.name).join(', ');
    }
    return Array.isArray(item.ingredients) ? item.ingredients.join(', ') : '';
  };
  const ingredientsText = getIngredientsText();

  const productDescription =
    item.content?.[currentLanguage]?.description || item.content?.en?.description || item.longDescription || '';
  const mainImageAlt = itemName || t('menu_item_image_alt');
  const numericPrice = typeof item.price === 'string' ? Number.parseFloat(item.price) : item.price;

  return (
    <div className={styles.menuItem} role="listitem" aria-labelledby={`item-name-${item.id}`}>
      <MenuItemImage
        imageUrl={item.image}
        alt={mainImageAlt}
        imageCount={item.images?.length}
        countLabel={t('images_count_label')}
        onClick={() => setShowDetails(true)}
        onError={() => getFallbackImage(item)}
      />
      <div className={styles.contentWrapper}>
        <MenuItemDetails
          id={item.id}
          title={itemName}
          description={productDescription}
          ingredients={ingredientsText}
          allergens={item.allergens}
          price={numericPrice}
          dietaryTags={item.dietaryTags}
          t={t}
          onTitleClick={() => setShowDetails(true)}
          initialRatingData={{ average: 0, count: 0 }}
        />
        <div className={styles.priceActionsRow}>
          <span className={styles.mobilePrice}>{formatPlainCurrency(numericPrice)}</span>
          <MenuItemActions
            onAdd={() => onAdd(item.id)}
            onFeedback={() => setShowFeedbackForm(item.id)}
            addAria={t('add_item_to_order', { itemName })}
            addLabel={t('add_to_order')}
            onDetails={() => setShowDetails(true)}
            detailsLabel={t('details')}
            feedbackAria={`${t('feedback_form_heading')} ${itemName}`}
            feedbackLabel={t('feedback_form_heading')}
          />
        </div>
      </div>
      {showFeedbackForm === item.id && (
        <FeedbackForm dishId={item.id} onSubmitSuccess={() => onFeedbackSuccess(item.id)} />
      )}
      <ProductDetailsModal isOpen={showDetails} item={item} onClose={() => setShowDetails(false)} />
    </div>
  );
}

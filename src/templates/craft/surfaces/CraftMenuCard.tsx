'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPlainCurrency } from '@/utils/currency';
import type { MenuCardProps } from '@/components/menu/MenuCard';
import { FALLBACK_IMAGE } from '@/utils/imageHelpers';
import { Plus } from 'lucide-react';
import MenuCardImage from '@/components/menu/MenuCardImage';
import AdminMenuCardControls from '@/components/menu/AdminMenuCardControls';
import AllergenDisplay from '@/components/common/AllergenDisplay';
import styles from './CraftMenuCard.module.css';

/**
 * Craft's browse-grid card (S15 T4 surface slot). A hand-lettered menu-board
 * entry — a letterpress + organic-corner card with a masking-tape "special"
 * label and a dotted-leader `name ..... price` header — genuinely distinct DOM
 * from the shared classic image-card. Reuses the shared image + actions so the
 * behaviour is identical to classic — the actions/title open the customization
 * sheet, the image opens the enlarge-on-click gallery (`MenuCardImage`); only the
 * composition differs. Rendered only in the craft build (resolved via `surfaceOr`).
 */
// `onFeedbackSuccess` is intentionally not destructured — craft's card doesn't
// surface feedback (parity with the shared card, whose feedback button is dormant),
// so the prop stays in the contract but is unused here.
export default function CraftMenuCard({ item, onOpen }: Readonly<MenuCardProps>) {
  const { t, i18n } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  // Locally reflect an admin inline price edit; resync if the item prop changes.
  const [price, setPrice] = useState(item.price);
  useEffect(() => setPrice(item.price), [item.price]);

  const lang = (i18n.language || 'en').split('-')[0];
  const itemName = item.content?.[lang]?.name || item.content?.en?.name || item.name;
  const description = item.content?.[lang]?.description || item.content?.en?.description || item.description;
  const bundleIncludes = item.isBundle ? (item.bundleItemNames ?? []).join(' + ') : '';
  // Add to Order adds a simple item straight to the cart; title/Details always open the sheet to
  // view the item (parity with the classic card).
  const open = () => onOpen(item);
  const openDetails = () => onOpen(item, { forceSheet: true });

  return (
    <article className={styles.card} role="listitem" aria-labelledby={`item-name-${item.id}`}>
      {item.isSpecial && (
        <span className={styles.special} data-testid="special-badge">
          {t('special')}
        </span>
      )}

      <AdminMenuCardControls item={item} onPriceChange={setPrice} />

      <MenuCardImage
        imageUrl={imageFailed ? FALLBACK_IMAGE : (item.imageUrl ?? FALLBACK_IMAGE)}
        alt={itemName || t('menu_item_image_alt')}
        images={item.images}
        imageCount={item.imageCount}
        countLabel={t('images_count_label')}
        enlargeLabel={t('menu_item_image_enlarge_aria', 'Enlarge {{itemName}} image', { itemName })}
        onError={() => setImageFailed(true)}
      />

      <div className={styles.body}>
        <button type="button" className={styles.leader} onClick={openDetails} id={`item-name-${item.id}`}>
          <span className={styles.name}>{itemName}</span>
          <span className={styles.price}>{formatPlainCurrency(price)}</span>
        </button>

        {description && <p className={styles.description}>{description}</p>}
        {bundleIncludes && <p className={styles.includes}>{bundleIncludes}</p>}
        {/* Shared allergen tags (emoji icon + translated label) — the craft card
            previously printed raw, icon-less keys. `compact` renders null when empty. */}
        <AllergenDisplay allergens={item.allergens} id={`craft-allergen-${item.id}`} variant="compact" />

        {/* Craft action row: a terracotta letterpress "Add" (+ glyph) and a kraft
            "Details" — both organic-cornered, instead of the shared classic pills. */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.addButton}
            onClick={open}
            aria-label={t('add_item_to_order', { itemName })}
          >
            <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
            {t('add_to_order', 'Add to Order')}
          </button>
          <button type="button" className={styles.detailsButton} onClick={openDetails}>
            {t('details', 'Details')}
          </button>
        </div>
      </div>
    </article>
  );
}

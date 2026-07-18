'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPlainCurrency } from '@/utils/currency';
import type { MenuCardProps } from '@/components/menu/MenuCard';
import { FALLBACK_IMAGE } from '@/utils/imageHelpers';
import MenuItemImage from '@/components/menu/MenuItemImage';
import MenuItemActions from '@/components/menu/MenuItemActions';
import craft from '../craft.module.css';
import styles from './CraftMenuCard.module.css';

/**
 * Craft's browse-grid card (S15 T4 surface slot). A hand-lettered menu-board
 * entry — a letterpress + organic-corner card with a masking-tape "special"
 * label and a dotted-leader `name ..... price` header — genuinely distinct DOM
 * from the shared classic image-card. Reuses the shared image + actions so the
 * behaviour (open the customization sheet) is identical; only the composition
 * differs. Rendered only in the craft build (resolved via `surfaceOr`).
 */
// `onFeedbackSuccess` is intentionally not destructured — craft's card doesn't
// surface feedback (parity with the shared card, whose feedback button is dormant),
// so the prop stays in the contract but is unused here.
export default function CraftMenuCard({ item, onOpen }: Readonly<MenuCardProps>) {
  const { t, i18n } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);

  const lang = (i18n.language || 'en').split('-')[0];
  const itemName = item.content?.[lang]?.name || item.content?.en?.name || item.name;
  const description = item.content?.[lang]?.description || item.content?.en?.description || item.description;
  const bundleIncludes = item.isBundle ? (item.bundleItemNames ?? []).join(' + ') : '';
  const open = () => onOpen(item);

  return (
    <article
      className={`${styles.card} ${craft.letterpress} ${craft.roundedCraft}`}
      role="listitem"
      aria-labelledby={`item-name-${item.id}`}
    >
      {item.isSpecial && (
        <span className={`${craft.tapeLabel} ${styles.special}`} data-testid="special-badge">
          {t('special')}
        </span>
      )}

      <MenuItemImage
        imageUrl={imageFailed ? FALLBACK_IMAGE : (item.imageUrl ?? FALLBACK_IMAGE)}
        alt={itemName || t('menu_item_image_alt')}
        imageCount={item.imageCount}
        countLabel={t('images_count_label')}
        onClick={open}
        onError={() => setImageFailed(true)}
      />

      <div className={styles.body}>
        <button
          type="button"
          className={`${craft.menuLeader} ${styles.leader}`}
          onClick={open}
          id={`item-name-${item.id}`}
        >
          <span className={styles.name}>{itemName}</span>
          <span className={styles.price}>{formatPlainCurrency(item.price)}</span>
        </button>

        {description && <p className={styles.description}>{description}</p>}
        {bundleIncludes && <p className={styles.includes}>{bundleIncludes}</p>}
        {item.allergens && item.allergens.length > 0 && (
          <p className={styles.allergens}>
            {t('allergens')}: {item.allergens.join(', ')}
          </p>
        )}

        <MenuItemActions
          onAdd={open}
          onFeedback={open}
          addAria={t('add_item_to_order', { itemName })}
          addLabel={t('add_to_order')}
          onDetails={open}
          detailsLabel={t('details')}
          feedbackAria={t('details')}
          feedbackLabel=""
        />
      </div>
    </article>
  );
}

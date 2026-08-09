'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPlainCurrency } from '@/utils/currency';
import type { MenuCardProps } from '@/components/menu/MenuCard';
import { FALLBACK_IMAGE } from '@/utils/imageHelpers';
import { Plus } from 'lucide-react';
import MenuCardImage from '@/components/menu/MenuCardImage';
import MenuCardAvailability from '@/components/menu/MenuCardAvailability';
import AdminMenuCardControls from '@/components/menu/AdminMenuCardControls';
import AdminPriceEditor from '@/components/menu/AdminPriceEditor';
import AllergenDisplay from '@/components/common/AllergenDisplay';
import { isItemBlocked, useItemAvailabilityNotice } from '@/hooks/menu/useItemAvailabilityNotice';
import { useTrackItemBlocked } from '@/hooks/menu/useTrackItemBlocked';
import styles from './CraftMenuCard.module.css';
// The notice's own look, shared with `CraftFeaturedSpecial` — see that module's header.
import availabilityStyles from './CraftItemAvailability.module.css';

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
export default function CraftMenuCard({ item, onOpen, onSwitchOrderType }: Readonly<MenuCardProps>) {
  const { t, i18n } = useTranslation();
  const availabilityNotice = useItemAvailabilityNotice(item.availability);
  useTrackItemBlocked(item.id, availabilityNotice);
  const isBlocked = isItemBlocked(item.availability, availabilityNotice);
  const nameId = `item-name-${item.id}`;
  const reasonId = `item-availability-${item.id}`;
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
    // Blocked cards stay listed with every control focusable, and the reason is folded into the
    // accessible name — parity with the shared card, including why `aria-disabled` is absent.
    <li
      // Addressable as a CARD, distinct from the Chef's Special hero that now shares this grid.
      // E2E-STRATEGY prefers role+name, and role+name cannot separate them here: when the promoted
      // dish is also in the catalogue (which is exactly the seeded fixture's case) both its hero and
      // its card offer a button named "Add <dish> to order", and both sit inside
      // `data-testid="menu-grid"`.
      data-testid="menu-card"
      className={isBlocked ? `${styles.card} ${styles.blocked}` : styles.card}
      aria-labelledby={isBlocked ? `${nameId} ${reasonId}` : nameId}
    >
      {item.isSpecial && (
        <span className={styles.special} data-testid="special-badge">
          {t('special')}
        </span>
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

      <div className={styles.body}>
        <button type="button" className={styles.leader} onClick={openDetails} id={nameId}>
          {/* product-authored text: dir="auto" so an English name inside an Arabic page keeps its own punctuation (DESIGN-SYSTEM.md §8.2) */}
          <span dir="auto" className={styles.name}>
            {itemName}
          </span>
          <span className={styles.price}>{formatPlainCurrency(price)}</span>
        </button>

        {/* Right under the name…price leader, aligned to the price end. It can't
            go INSIDE the leader — that's a button, and buttons don't nest. */}
        <div className={styles.adminRow}>
          <AdminPriceEditor item={item} onPriceChange={setPrice} />
        </div>

        {description && (
          <p dir="auto" className={styles.description}>
            {description}
          </p>
        )}
        {bundleIncludes && (
          <p dir="auto" className={styles.includes}>
            {bundleIncludes}
          </p>
        )}
        {/* Shared allergen tags (emoji icon + translated label) — the craft card
            previously printed raw, icon-less keys. `compact` renders null when empty. */}
        <AllergenDisplay allergens={item.allergens} id={`craft-allergen-${item.id}`} variant="compact" />

        {availabilityNotice && (
          <MenuCardAvailability
            notice={availabilityNotice}
            reasonId={reasonId}
            onSwitchOrderType={onSwitchOrderType}
            styles={availabilityStyles}
          />
        )}

        {/* Craft action row: a terracotta letterpress "Add" (+ glyph) and a kraft
            "Details" — both organic-cornered, instead of the shared classic pills.
            "Add" is dropped while blocked (the notice above offers the switch instead),
            never rendered disabled — parity with the shared card. */}
        <div className={styles.actions}>
          {!isBlocked && (
            <button
              type="button"
              className={styles.addButton}
              onClick={open}
              aria-label={t('add_item_to_order', { itemName })}
            >
              <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
              {t('add_to_order', 'Add to Order')}
            </button>
          )}
          <button type="button" className={styles.detailsButton} onClick={openDetails}>
            {t('details', 'Details')}
          </button>
        </div>
      </div>
    </li>
  );
}

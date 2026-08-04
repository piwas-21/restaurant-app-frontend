'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';
import { Clock } from 'lucide-react';
import { formatPlainCurrency } from '@/utils/currency';
import AllergenDisplay from '@/components/common/AllergenDisplay';
import MenuCardAvailability from '@/components/menu/MenuCardAvailability';
import AdminMenuCardControls from '@/components/menu/AdminMenuCardControls';
import AdminPriceEditor from '@/components/menu/AdminPriceEditor';
import { useFeaturedSpecialHero } from '@/hooks/menu/useFeaturedSpecialHero';
import { FALLBACK_IMAGE } from '@/utils/imageHelpers';
import type { FeaturedSpecialProps } from '@/components/menu/FeaturedSpecial';
import styles from './CraftFeaturedSpecial.module.css';
import availabilityStyles from './CraftItemAvailability.module.css';

/**
 * Craft's Chef's Special hero (S15 T4 surface slot).
 *
 * Until now this was the ONE customer surface with no craft counterpart: the banner rendered the
 * classic gold-gradient card in both templates, sitting above a kraft-paper menu board it shared no
 * vocabulary with. The file said so itself. This is the counterpart — a taped-up daily-special
 * notice: a kraft plate, a masking-tape header, an Amatic `name ..... price` dotted leader, and the
 * photo pinned on at an angle.
 *
 * Deliberately the NEUTRAL `tapeLabel` for the "Chef's Special" marker, not the saffron
 * `tapeLabelAccent`. Saffron is what a BLOCKED item's tape wears (`CraftItemAvailability`), and
 * spending it here would make "featured" and "unavailable" read as the same object — the collision
 * BUGS-IMPROVEMENTS-PLAN E6 was corrected for wrongly claiming already existed. `CraftMenuCard`
 * marks its own specials with the neutral tape for the same reason.
 *
 * Every decision comes from `useFeaturedSpecialHero`, shared with the classic hero; this file is
 * composition and CSS only.
 */
export default function CraftFeaturedSpecial({
  special,
  onAddToCart,
  onViewDetails,
  onSwitchOrderType,
}: Readonly<FeaturedSpecialProps>) {
  const { t } = useTranslation();
  const { availabilityNotice, isBlocked, reasonId, itemName, description, price, onPriceChange, adminItem } =
    useFeaturedSpecialHero(special);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <section
      className={isBlocked ? `${styles.hero} ${styles.blocked}` : styles.hero}
      // The reason joins the accessible name while blocked, so the recede is announced with its
      // cause rather than as an unexplained style (same rule as the card).
      aria-labelledby={isBlocked ? `featured-special-heading ${reasonId}` : 'featured-special-heading'}
    >
      <div className={styles.header}>
        <span className={styles.tape}>{t('chefs_special', "Chef's Special")}</span>
        {/* The hero was the one item on the menu page an admin could not act on. */}
        <AdminMenuCardControls item={adminItem} />
      </div>

      <div className={special.imageUrl ? `${styles.content} ${styles.withPhoto}` : styles.content}>
        {special.imageUrl && (
          <div className={styles.photo}>
            <Image
              src={imageFailed ? FALLBACK_IMAGE : special.imageUrl}
              alt={itemName}
              width={400}
              height={300}
              className={styles.photoImage}
              onError={() => setImageFailed(true)}
            />
          </div>
        )}

        <div className={styles.details}>
          {/* The craft signature: the dish and its price on one dotted leader, hand-lettered. A
              heading rather than a button — unlike a card, the hero has its own Details control. */}
          <div className={styles.leader}>
            {/* product-authored text: dir="auto" so an English name inside an Arabic page keeps its own punctuation (DESIGN-SYSTEM.md §8.2) */}
            <h2 id="featured-special-heading" dir="auto" className={styles.name}>
              {itemName}
            </h2>
            <span className={styles.price}>{formatPlainCurrency(price)}</span>
          </div>

          {/* Beside the price it edits, as on the craft card. Renders nothing for a guest; for an
              admin it always renders something — the control, or the reason it cannot apply. */}
          <div className={styles.adminRow}>
            <AdminPriceEditor item={adminItem} onPriceChange={onPriceChange} />
          </div>

          {description && (
            <p dir="auto" className={styles.description}>
              {description}
            </p>
          )}

          {special.preparationTimeMinutes > 0 && (
            <p className={styles.time}>
              <Clock size={15} aria-hidden="true" />
              {special.preparationTimeMinutes} {t('minutes', 'min')}
            </p>
          )}

          <AllergenDisplay allergens={special.allergens} id={`craft-featured-${special.id}`} variant="compact" />

          {availabilityNotice && (
            <MenuCardAvailability
              notice={availabilityNotice}
              reasonId={reasonId}
              onSwitchOrderType={onSwitchOrderType}
              styles={availabilityStyles}
            />
          )}

          {/* "Add" is REMOVED while blocked, never rendered disabled — the switch inside the notice
              above is the way out. Details stays: it only SHOWS the item, and the sheet is handed
              the same verdict so it refuses the add too. */}
          <div className={styles.actions}>
            {onAddToCart && !isBlocked && (
              <button
                type="button"
                className={styles.addButton}
                onClick={() => onAddToCart({ availability: special.availability })}
                aria-label={t('add_to_order', 'Add to Order')}
              >
                {t('add_to_order', 'Add to Order')}
              </button>
            )}
            {onViewDetails && (
              <button
                type="button"
                className={styles.detailsButton}
                onClick={() => onViewDetails({ forceSheet: true, availability: special.availability })}
                aria-label={t('view_details', 'View Details')}
              >
                {t('details', 'Details')}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

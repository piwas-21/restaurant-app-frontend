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
import OrderTypeRibbon from '@/components/menu/OrderTypeRibbon';
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

      <div className={styles.content}>
        {/* ALWAYS a photo, falling back to the same placeholder every card uses. It used to render
            nothing at all without `imageUrl` — so on the live tenant, whose special carries no
            image, the promoted dish was the one item on the page with no picture while the same
            dish two cells down in the grid showed the placeholder. The classic hero was fixed for
            exactly this a day earlier; craft had not been, which is what the owner meant by the
            craft theme not having the classic theme's improvements. */}
        <div className={styles.photo}>
          <Image
            src={imageFailed ? FALLBACK_IMAGE : special.imageUrl || FALLBACK_IMAGE}
            alt={itemName}
            width={400}
            height={300}
            className={styles.photoImage}
            onError={() => setImageFailed(true)}
          />

          {/* The corner band craft never had, and the allergen chips, both on the photograph — the
              card's two marks, on the hero, for the same reasons. */}
          {isBlocked && availabilityNotice && (
            <OrderTypeRibbon label={availabilityNotice.message} compactLabel={availabilityNotice.shortMessage} />
          )}
          <span className={styles.photoOverlay}>
            <AllergenDisplay
              allergens={special.allergens}
              id={`craft-featured-${special.id}`}
              maxVisible={2}
              variant="photo"
            />
          </span>
        </div>

        <div className={styles.details}>
          {/* The name, alone. It was the first half of a `dish ..... price` dotted leader; the
              leader is the FOOT row now, joining the price to the add control. */}
          {/* product-authored text: dir="auto" so an English name inside an Arabic page keeps its own punctuation (DESIGN-SYSTEM.md §8.2) */}
          <h2 id="featured-special-heading" dir="auto" className={styles.name}>
            {itemName}
          </h2>

          {/* Details floated onto the end of the description's clipped last line, out of the action
              row. First in source order: a float is only wrapped by what follows it. */}
          {description ? (
            <p dir="auto" className={styles.description}>
              {onViewDetails && (
                <button
                  type="button"
                  className={styles.detailsLink}
                  onClick={() => onViewDetails({ forceSheet: true, availability: special.availability })}
                  aria-label={t('menu_item_details_aria', { itemName })}
                >
                  {t('details', 'Details')}
                </button>
              )}
              <span className={styles.descriptionText}>{description}</span>
            </p>
          ) : (
            onViewDetails && (
              <button
                type="button"
                className={styles.detailsButton}
                onClick={() => onViewDetails({ forceSheet: true, availability: special.availability })}
                aria-label={t('menu_item_details_aria', { itemName })}
              >
                {t('details', 'Details')}
              </button>
            )
          )}

          {special.preparationTimeMinutes > 0 && (
            <p className={styles.time}>
              <Clock size={15} aria-hidden="true" />
              {special.preparationTimeMinutes} {t('minutes', 'min')}
            </p>
          )}

          {/* `info` keeps craft's saffron tape here; the blocked notice moves into the foot, where
              its switch link stands in for the removed Add. */}
          {availabilityNotice && !isBlocked && (
            <MenuCardAvailability
              notice={availabilityNotice}
              reasonId={reasonId}
              onSwitchOrderType={onSwitchOrderType}
              styles={availabilityStyles}
            />
          )}

          {/* The dotted leader in its new place: price ..... action. "Add" is REMOVED while
              blocked, never rendered disabled — the switch beside it is the way out. Details stays
              live either way: it only SHOWS the item, and the sheet is handed the same verdict so
              it refuses the add too. */}
          <div className={styles.foot}>
            <span className={styles.price}>
              {formatPlainCurrency(price)}
              {/* Beside the price it edits, as on the craft card. Renders nothing for a guest; for
                  an admin it always renders something — the control, or why it cannot apply. */}
              <AdminPriceEditor item={adminItem} onPriceChange={onPriceChange} />
            </span>

            {isBlocked
              ? availabilityNotice && (
                  <MenuCardAvailability
                    notice={availabilityNotice}
                    reasonId={reasonId}
                    onSwitchOrderType={onSwitchOrderType}
                    styles={availabilityStyles}
                  />
                )
              : onAddToCart && (
                  <button
                    type="button"
                    className={styles.addButton}
                    onClick={() => onAddToCart({ availability: special.availability })}
                    aria-label={t('add_item_to_order', { itemName })}
                  >
                    {t('add')}
                  </button>
                )}
          </div>
        </div>
      </div>
    </section>
  );
}

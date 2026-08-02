'use client';

import { formatPlainCurrency } from '@/utils/currency';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Clock } from 'lucide-react';
import Image from 'next/image';
import styles from './FeaturedSpecial.module.css';
// The notice's OWN styles come from the classic card's module, not this one: `MenuCardAvailability`
// reads only `availability*` classes (its §4.5 contract), and re-declaring those ~60 lines here
// would be a second source of truth for one look — and Sonar new-code duplication besides. The
// banner has no craft surface override, so like the rest of it this renders classic in both
// templates; skinning the hero for craft is its own piece of work.
import availabilityStyles from './MenuItemAvailability.module.css';
import AllergenDisplay from '@/components/common/AllergenDisplay';
import MenuCardAvailability from './MenuCardAvailability';
import { isItemBlocked, useItemAvailabilityNotice } from '@/hooks/menu/useItemAvailabilityNotice';
import { useTrackItemBlocked } from '@/hooks/menu/useTrackItemBlocked';
import type { OrderType } from '@/types/order';
import type { OpenSheetOptions } from '@/hooks/menu/sheetOptions';
import type { FeaturedSpecial as FeaturedSpecialType } from '@/types/menu';

interface FeaturedSpecialProps {
  special: FeaturedSpecialType;
  /**
   * Both handlers receive the sheet options to open with, rather than the page building them.
   *
   * The banner is the component that HOLDS the verdict, so it is the one that hands it over
   * (§9.10) — a page that forgot to pass `availability` would silently reopen the hole this closes,
   * and nothing would fail. Same reasoning as the guard living on `openForProductId` rather than on
   * each caller: put it where forgetting is impossible, not where discipline is required.
   */
  onAddToCart?: (opts: OpenSheetOptions) => void;
  onViewDetails?: (opts: OpenSheetOptions) => void;
  /** "Switch to X" — the page's `useOrderTypeFollowUp().pickType`, as the catalog cards get. */
  onSwitchOrderType?: (type: OrderType) => void;
}

const FeaturedSpecial: React.FC<FeaturedSpecialProps> = ({
  special,
  onAddToCart,
  onViewDetails,
  onSwitchOrderType,
}) => {
  const { t } = useTranslation();
  // G7: the hero is an ENTRY POINT — a guest can order straight from it — so it carries the same
  // verdict, the same notice component and the same rule as a catalog card.
  const availabilityNotice = useItemAvailabilityNotice(special?.availability);
  useTrackItemBlocked(special?.id, availabilityNotice, 'featured_special');

  if (!special) {
    return null;
  }

  // The SERVER's verdict is the gate, not our ability to render a reason for it — the same
  // predicate `ItemCustomizationSheet` uses. `useItemAvailabilityNotice` returns null while the
  // enabled-channel list loads AND for `reason: 'Unavailable'`, and unlike a card this hero is NOT
  // filtered by `isVisible` (the featured query filters on IsActive, never IsAvailable), so an
  // unavailable special reaches here with `canOrder: false` and no notice to show for it.
  const isBlocked = isItemBlocked(special?.availability, availabilityNotice);
  const reasonId = `featured-special-availability-${special.id}`;

  return (
    <section
      className={
        isBlocked ? `${styles.featuredSpecialSection} ${styles.featuredSpecialBlocked}` : styles.featuredSpecialSection
      }
      // The reason joins the section's accessible name while blocked, so the recede is announced
      // with its cause rather than as an unexplained style (same rule as the card).
      aria-labelledby={isBlocked ? `featured-special-heading ${reasonId}` : 'featured-special-heading'}
    >
      <div className={styles.featuredSpecialContainer}>
        <div className={styles.featuredSpecialBadge}>
          <Star size={20} fill="gold" color="gold" />
          <span>{t('chefs_special', "Chef's Special")}</span>
        </div>

        <div className={styles.featuredSpecialContent}>
          {special.imageUrl && (
            <div className={styles.featuredSpecialImageContainer}>
              <Image
                src={special.imageUrl}
                alt={special.name}
                width={400}
                height={300}
                style={{ objectFit: 'cover' }}
                className={styles.featuredSpecialImage}
              />
            </div>
          )}

          <div className={styles.featuredSpecialDetails}>
            <h2 id="featured-special-heading" className={styles.featuredSpecialTitle}>
              {special.name}
            </h2>

            {special.preparationTimeMinutes > 0 && (
              <div className={styles.featuredSpecialTime}>
                <Clock size={16} />
                <span>
                  {special.preparationTimeMinutes} {t('minutes', 'min')}
                </span>
              </div>
            )}

            {/* {special.description && (
              <p className={styles.featuredSpecialDescription}>{special.description}</p>
            )} */}

            <div className={styles.featuredSpecialMeta}>
              <div className={styles.featuredSpecialPrice}>
                {/* <span className={styles.priceLabel}>{t('price', 'Price')}:</span> */}
                <span className={styles.priceValue}>{formatPlainCurrency(special.basePrice)}</span>
              </div>
            </div>

            {/* {ingredientsList && ingredientsList.length > 0 && (
              <div className={styles.featuredSpecialIngredients}>
                <strong>{t('ingredients', 'Ingredients')}:</strong>{' '}
                <span>{ingredientsList.join(', ')}</span>
              </div>
            )} */}

            {special.allergens && special.allergens.length > 0 && (
              <div className={styles.featuredSpecialAllergens}>
                <AllergenDisplay
                  allergens={special.allergens}
                  id={`featured-special-${special.id}`}
                  maxVisible={10}
                  showLabel={true}
                  variant="admin"
                  className={styles.allergenContainer}
                  contentClassName={styles.allergensContentLeft}
                />
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

            <div className={styles.featuredSpecialActions}>
              {/* REMOVED, not disabled, while blocked — the S4 rule: nothing focusable-but-dead, and
                  the switch inside the notice above is the way out. Details stays: it only SHOWS the
                  item, and the sheet is handed the same verdict so it refuses the add too. */}
              {onAddToCart && !isBlocked && (
                <button
                  className={styles.featuredSpecialAddButton}
                  onClick={() => onAddToCart({ availability: special.availability })}
                  aria-label={t('add_to_order', 'Add to Order')}
                >
                  {t('add_to_order', 'Add to Order')}
                </button>
              )}
              {onViewDetails && (
                <button
                  className={styles.featuredSpecialDetailsButton}
                  // Details only SHOWS the item, so it stays reachable while blocked — which is
                  // precisely why the verdict has to ride along: the sheet's footer Add is the
                  // two-clicks-away path S4 closed on the cards.
                  onClick={() => onViewDetails({ forceSheet: true, availability: special.availability })}
                  aria-label={t('view_details', 'View Details')}
                >
                  {t('details', 'Details')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturedSpecial;

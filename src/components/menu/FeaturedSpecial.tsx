'use client';

import { formatPlainCurrency } from '@/utils/currency';
import { useTranslation } from 'react-i18next';
import { Star, Clock } from 'lucide-react';
import Image from 'next/image';
import styles from './FeaturedSpecial.module.css';
// The notice's OWN styles come from the classic card's module, not this one: `MenuCardAvailability`
// reads only `availability*` classes (its §4.5 contract), and re-declaring those ~60 lines here
// would be a second source of truth for one look — and Sonar new-code duplication besides.
import availabilityStyles from './MenuItemAvailability.module.css';
import AllergenDisplay from '@/components/common/AllergenDisplay';
import MenuCardAvailability from './MenuCardAvailability';
import AdminMenuCardControls from './AdminMenuCardControls';
import AdminPriceEditor from './AdminPriceEditor';
import { useFeaturedSpecialHero } from '@/hooks/menu/useFeaturedSpecialHero';
import type { OrderType } from '@/types/order';
import type { OpenSheetOptions } from '@/hooks/menu/sheetOptions';
import type { FeaturedSpecial as FeaturedSpecialType } from '@/types/menu';

export interface FeaturedSpecialProps {
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

/**
 * The Chef's Special hero — classic's rendering, and the shared default for any template that ships
 * no `FeaturedSpecial` surface of its own.
 *
 * Every decision it makes comes from `useFeaturedSpecialHero`; this file is composition and CSS.
 * The former guard `if (!special) return null` is gone: the prop is non-nullable and the one caller
 * (`app/menu/page.tsx`) renders this only inside `{featuredSpecial && …}`, so the branch was
 * unreachable and, being unreachable, was quietly untested.
 */
export default function FeaturedSpecial({
  special,
  onAddToCart,
  onViewDetails,
  onSwitchOrderType,
}: Readonly<FeaturedSpecialProps>) {
  const { t } = useTranslation();
  const { availabilityNotice, isBlocked, reasonId, itemName, description, price, onPriceChange, adminItem } =
    useFeaturedSpecialHero(special);

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
        {/* A ribbon over the strip's leading corner — on the photo when there is one, on the panel
            when there isn't. It was a chip inside a header ROW above the content, which cost the
            strip a whole band of height for one word and is not the shape the design has. A direct
            child of the container rather than of the photo, so the no-photo special still gets it. */}
        <div className={styles.featuredSpecialBadge}>
          <Star size={14} fill="currentColor" aria-hidden="true" />
          <span>{t('chefs_special', "Chef's Special")}</span>
        </div>

        {/* The hero was the ONE item on the menu page an admin could not act on: every card
            renders these two, and the banner rendered neither. */}
        <div className={styles.featuredSpecialHeader}>
          <AdminMenuCardControls item={adminItem} />
        </div>

        {/* No `.withPhoto` modifier any more. The old grid had to declare a photo COLUMN, so when
            a special had no image — which is what the live tenant's actually has — the details
            landed in the photo's column and wrapped at 340px with the rest of the hero empty. A
            flex row with the photo as an optional first child cannot express that state. */}
        <div className={styles.featuredSpecialContent}>
          {special.imageUrl && (
            <div className={styles.featuredSpecialImageContainer}>
              {/* `object-fit` moved to the stylesheet — it is a fixed rule, not a computed value,
                  and §5.6 keeps inline styles for the computed ones only. */}
              <Image
                src={special.imageUrl}
                alt={itemName}
                width={400}
                height={300}
                className={styles.featuredSpecialImage}
              />
            </div>
          )}

          <div className={styles.featuredSpecialDetails}>
            {/* product-authored text: dir="auto" (DESIGN-SYSTEM.md §8.2) */}
            <h2 id="featured-special-heading" dir="auto" className={styles.featuredSpecialTitle}>
              {itemName}
            </h2>

            {description && (
              <p dir="auto" className={styles.featuredSpecialDescription}>
                {description}
              </p>
            )}

            {/* Prep time, price and the admin control share ONE line. They were three stacked
                blocks with a 1.5rem margin each, which is most of the height this strip lost. */}
            <div className={styles.featuredSpecialMeta}>
              {special.preparationTimeMinutes > 0 && (
                <span className={styles.featuredSpecialTime}>
                  <Clock size={15} aria-hidden="true" />
                  <span>
                    {special.preparationTimeMinutes} {t('minutes', 'min')}
                  </span>
                </span>
              )}
              <span className={styles.priceValue}>{formatPlainCurrency(price)}</span>
              {/* Beside the price it edits, exactly as on a card. It renders nothing for a guest,
                  and for an admin it always renders SOMETHING — the control, or the reason it
                  cannot apply (E3). */}
              <AdminPriceEditor item={adminItem} onPriceChange={onPriceChange} />
            </div>

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
              <div className={styles.availabilitySlot}>
                <MenuCardAvailability
                  notice={availabilityNotice}
                  reasonId={reasonId}
                  onSwitchOrderType={onSwitchOrderType}
                  styles={availabilityStyles}
                />
              </div>
            )}
          </div>

          {/* A SIBLING of the text column, not the last block inside it — that is what turns the
              hero from a stacked card into a strip: photo | text | action, on one baseline. */}
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
    </section>
  );
}

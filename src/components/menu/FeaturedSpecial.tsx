'use client';

import { formatPlainCurrency } from '@/utils/currency';
import { useState } from 'react';
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
import AddToOrderButton from './AddToOrderButton';
import AdminMenuCardControls from './AdminMenuCardControls';
import AdminPriceEditor from './AdminPriceEditor';
// The editing ring, shared with the catalog card so the two hosts cannot drift into two rings.
import adminPriceStyles from './AdminPriceEditorHost.module.css';
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
  const [priceEditing, setPriceEditing] = useState(false);

  return (
    <section
      className={
        isBlocked ? `${styles.featuredSpecialSection} ${styles.featuredSpecialBlocked}` : styles.featuredSpecialSection
      }
      // The reason joins the section's accessible name while blocked, so the recede is announced
      // with its cause rather than as an unexplained style (same rule as the card).
      aria-labelledby={isBlocked ? `featured-special-heading ${reasonId}` : 'featured-special-heading'}
    >
      {/* The ring goes on the CONTAINER, not the <section>: the container is the box that carries
          the strip's border, radius and surface — the <section> is a layout wrapper with no box of
          its own, so an outline on it would trace a rectangle nobody drew. */}
      <div
        className={[
          styles.featuredSpecialContainer,
          special.imageUrl ? null : styles.featuredSpecialNoPhoto,
          priceEditing ? adminPriceStyles.hostEditing : null,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* The hero was the ONE item on the menu page an admin could not act on: every card
            renders these two, and the banner rendered neither. */}
        <div className={styles.featuredSpecialHeader}>
          <AdminMenuCardControls item={adminItem} />
        </div>

        {/* The photo is an OPTIONAL first child of a flex row — the old grid declared a photo
            COLUMN, so a special with no image (which is what the live tenant's actually has) put
            the details in the photo's cell and wrapped at 340px with the rest of the hero empty.
            The `.featuredSpecialNoPhoto` modifier above is the CSS half of the same fact: the
            markup already omitted the <Image>, but the strip went on reserving a photo's worth of
            height for it. A class, not `:has()` — the review gate and older Safari treat that
            unevenly, and one boolean the component already knows does not need a selector. */}
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
            {/* A ribbon on the photo's leading corner when there IS a photo (it is absolutely placed
                against the container, which is the positioned ancestor, so living in this column
                changes nothing there) and an in-flow pill above the name when there is not. It used
                to be absolute at EVERY width, and RUMI's live special carries no image — so on a
                375px phone the badge ran straight through the dish name: badge bottom 143.8 against
                title top 135.8, measured on staging. */}
            <div className={styles.featuredSpecialBadge}>
              <Star size={14} fill="currentColor" aria-hidden="true" />
              <span>{t('chefs_special', "Chef's Special")}</span>
            </div>

            {/* product-authored text: dir="auto" (DESIGN-SYSTEM.md §8.2).
                The name is the route into the details sheet, as it already is on every card
                (`MenuItemDetails`) — a real <button> nested in the heading rather than
                `role="button"` ON it, so the strip keeps its <h2> and the section's accessible name
                still reads "<dish> <reason>" while blocked. That is what let the second, competing
                "Details" button go: every generated special screen has exactly one action. */}
            {/* Name against price on ONE row, the same anatomy every card below uses — the price
                used to sit two blocks lower, beside the prep time, so the hero was the one dish on
                the page whose price was not where the eye had just learned to look. */}
            <div className={styles.featuredSpecialTitleRow}>
              <h2 id="featured-special-heading" dir="auto" className={styles.featuredSpecialTitle}>
                {onViewDetails ? (
                  <button
                    type="button"
                    className={styles.featuredSpecialTitleButton}
                    // The verdict rides along, exactly as Details handed it over: the sheet's own
                    // footer Add is the two-clicks-away path S4 closed on the cards. Unlike Add this
                    // is NOT removed while blocked — showing the item is always allowed, and it is
                    // now the only route to the sheet.
                    onClick={() => onViewDetails({ forceSheet: true, availability: special.availability })}
                  >
                    {itemName}
                  </button>
                ) : (
                  itemName
                )}
              </h2>
              <span className={styles.featuredSpecialTitleMeta}>
                <span className={styles.priceValue}>{formatPlainCurrency(price)}</span>
                {/* Beside the price it edits, exactly as on a card. It renders nothing for a guest,
                    and for an admin it always renders SOMETHING — the control, or the reason it
                    cannot apply (E3). */}
                <AdminPriceEditor item={adminItem} onPriceChange={onPriceChange} onEditingChange={setPriceEditing} />
              </span>
            </div>

            {description && (
              <p dir="auto" className={styles.featuredSpecialDescription}>
                {description}
              </p>
            )}

            {/* Prep time only — the price moved up to the title row above it. */}
            {special.preparationTimeMinutes > 0 && (
              <div className={styles.featuredSpecialMeta}>
                <span className={styles.featuredSpecialTime}>
                  <Clock size={15} aria-hidden="true" />
                  <span>
                    {special.preparationTimeMinutes} {t('minutes', 'min')}
                  </span>
                </span>
              </div>
            )}

            {special.allergens && special.allergens.length > 0 && (
              // The wrapper is `display: none` at every width — allergens belong on the dish CARD
              // and in the sheet. The two layout classes that used to be handed down here went with
              // it: they had been dressing the subtree of a hidden element.
              <div className={styles.featuredSpecialAllergens}>
                <AllergenDisplay
                  allergens={special.allergens}
                  id={`featured-special-${special.id}`}
                  maxVisible={10}
                  showLabel={true}
                  variant="admin"
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

            {/* The LAST ROW of the text column, not a column of its own. As a third sibling the
                action was full-cell height beside a 180px strip, which stopped reading as an
                action once the hero became a card in the grid rather than a band above it — the
                design puts the signature label and the filled button on one baseline at the foot
                of the copy.

                REMOVED, not disabled, while blocked — the S4 rule: nothing focusable-but-dead, and
                the switch inside the notice above is the way out. The dish name stays live, and the
                sheet is handed the same verdict so it refuses the add too. */}
            <div className={styles.featuredSpecialActions}>
              <span className={styles.signatureLabel}>
                <Star size={14} aria-hidden="true" />
                {t('chefs_special', "Chef's Special")}
              </span>
              {onAddToCart && !isBlocked && (
                /* SOLID, and the only filled button on the page — the shared control the grid cards
                   render outlined. One component, so the promoted dish and the dishes below it
                   cannot drift apart in radius, target size or hover colour. */
                <AddToOrderButton
                  onAdd={() => onAddToCart({ availability: special.availability })}
                  label={t('add_to_order', 'Add to Order')}
                  ariaLabel={t('add_item_to_order', { itemName })}
                  variant="solid"
                  shape="hero"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';

import { formatPlainCurrency } from '@/utils/currency';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Clock } from 'lucide-react';
import { FALLBACK_IMAGE } from '@/utils/imageHelpers';
import Image from 'next/image';
import styles from './FeaturedSpecial.module.css';
// The notice's OWN styles come from the classic card's module, not this one: `MenuCardAvailability`
// reads only `availability*` classes (its §4.5 contract), and re-declaring those ~60 lines here
// would be a second source of truth for one look — and Sonar new-code duplication besides.
import availabilityStyles from './MenuItemAvailability.module.css';
import AllergenDisplay from '@/components/common/AllergenDisplay';
import OrderTypeRibbon from './OrderTypeRibbon';
import MenuCardAvailability from './MenuCardAvailability';
import AddToOrderButton from './AddToOrderButton';
import AdminMenuCardControls from './AdminMenuCardControls';
import AdminPriceEditor from './AdminPriceEditor';
// The editing ring, shared with the catalog card so the two hosts cannot drift into two rings.
import adminPriceStyles from './AdminPriceEditorHost.module.css';
import FeaturedSpecialCopy from './FeaturedSpecialCopy';
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
          {/* ALWAYS a photo box, falling back to the same placeholder every card uses. It used to
              render nothing at all without `imageUrl`, so the promoted dish was the one item on the
              page with no image while the identical dish in the grid two cells away showed the
              placeholder. `.featuredSpecialNoPhoto` still marks the case for the badge's in-flow
              fallback, but it no longer means "render no photo". */}
          <div className={styles.featuredSpecialImageContainer}>
            {/* `object-fit` moved to the stylesheet — it is a fixed rule, not a computed value,
                and §5.6 keeps inline styles for the computed ones only. */}
            <Image
              src={special.imageUrl || FALLBACK_IMAGE}
              alt={itemName}
              width={400}
              height={300}
              className={styles.featuredSpecialImage}
            />

            {/* The order-type band and the allergen chips, on the PHOTO — the same two marks and
                the same two corners every card carries, because the hero is a cell of the same
                grid. The band was pinned to the hero's outer container before; on a card that
                container and the photo share a top corner, and here they do not — the hero is a
                flex ROW, so the band wrapped the corner of the whole hero rather than of its
                picture. */}
            {isBlocked && availabilityNotice && (
              <OrderTypeRibbon label={availabilityNotice.message} compactLabel={availabilityNotice.shortMessage} />
            )}
            <span className={styles.featuredSpecialPhotoOverlay}>
              {/* Glyph-and-word chips, off the title row. The hero was the only dish on the menu
                  whose allergens were hidden outright (`display: none` from an earlier slice) —
                  the one place a guest with an allergy is most likely to look first. */}
              <AllergenDisplay
                allergens={special.allergens}
                id={`featured-special-${special.id}`}
                maxVisible={2}
                variant="photo"
              />
            </span>
          </div>

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

            {/* The name and the description-with-Details, extracted for length (§4) — see
                `FeaturedSpecialCopy`, which owns the float that puts "Details" at the end of the
                clipped last line. The verdict rides along on the click, exactly as it does from the
                add control: the sheet's own footer Add is the two-clicks-away path S4 closed. Unlike
                Add this is NOT withheld while blocked — showing an item is always allowed. */}
            <FeaturedSpecialCopy
              itemName={itemName}
              description={description}
              onOpenDetails={
                onViewDetails
                  ? () => onViewDetails({ forceSheet: true, availability: special.availability })
                  : undefined
              }
            />

            {/* Prep time only — the price is in the hero's foot, below. */}
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
            {/* The hero's foot, the same row the cards now carry: price at the inline start, the
                one action opposite it. The price used to sit on the title row; before that it was
                two blocks lower beside the prep time. Here it shares a baseline with the button,
                which is what the owner's crop draws. */}
            <div className={styles.featuredSpecialActions}>
              <span className={styles.priceValue}>
                {formatPlainCurrency(price)}
                {/* Beside the price it edits, exactly as on a card. It renders nothing for a guest,
                    and for an admin it always renders SOMETHING — the control, or the reason it
                    cannot apply (E3). */}
                <AdminPriceEditor item={adminItem} onPriceChange={onPriceChange} onEditingChange={setPriceEditing} />
              </span>
              {/* No signature label here. The badge at the top of the hero already says "Chef's
                  Special"; a second copy at the foot said it twice on one card. */}
              {onAddToCart && !isBlocked && (
                /* SOLID, and the only filled button on the page — the shared control the grid cards
                   render outlined. One component, so the promoted dish and the dishes below it
                   cannot drift apart in radius, target size or hover colour. */
                <AddToOrderButton
                  onAdd={() => onAddToCart({ availability: special.availability })}
                  // The same one word the cards use. §7c made this one COMPONENT so the three add
                  // controls could not drift in radius, target size or hover colour; two different
                  // written labels on one page would be that drift by another route. The full
                  // "Add {dish} to order" sentence is still the accessible name.
                  label={t('add')}
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

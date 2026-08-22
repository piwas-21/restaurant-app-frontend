'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cardPriceText } from '@/utils/currency';
import type { MenuCardProps } from '@/components/menu/MenuCard';
import { FALLBACK_IMAGE } from '@/utils/imageHelpers';
import { Plus } from 'lucide-react';
import MenuCardImage from '@/components/menu/MenuCardImage';
import MenuCardAvailability from '@/components/menu/MenuCardAvailability';
import AdminMenuCardControls from '@/components/menu/AdminMenuCardControls';
import AdminPriceEditor from '@/components/menu/AdminPriceEditor';
import AllergenDisplay from '@/components/common/AllergenDisplay';
import OrderTypeRibbon from '@/components/menu/OrderTypeRibbon';
import { isItemBlocked, useItemAvailabilityNotice } from '@/hooks/menu/useItemAvailabilityNotice';
import { useTrackItemBlocked } from '@/hooks/menu/useTrackItemBlocked';
import styles from './CraftMenuCard.module.css';
// The notice's own look, shared with `CraftFeaturedSpecial` — see that module's header.
import availabilityStyles from './CraftItemAvailability.module.css';

/**
 * Craft's browse-grid card (S15 T4 surface slot). A hand-lettered menu-board entry — a letterpress
 * + organic-corner card with a masking-tape "special" label and a dotted leader — genuinely
 * distinct DOM from the shared classic image-card. Reuses the shared image + actions so the
 * behaviour is identical to classic; only the composition differs. Rendered only in the craft build
 * (resolved via `surfaceOr`).
 *
 * **Brought up to the classic card's 2026-08-09 anatomy, in craft's own materials.** The owner's
 * review of the layout redesign ended *"also to the new craft theme properly. i think the craft
 * design doesn't even have any previous design improvements we did for classical theme"*, and that
 * was accurate — this card had never received the order-type corner band (§7c), so a craft guest on
 * a channel that cannot order a dish saw a tape chip and no glance-readable marker at all.
 *
 * Four things changed and each is the classic decision re-expressed rather than copied:
 *
 * - **The dotted leader moved from the header to the foot.** It was `name ..... price`, the printed
 *   -menu convention and craft's signature line. The price now sits opposite the add control, as
 *   the owner asked — so the leader goes with it and reads `CHF 45.00 ..... Add`. The motif is
 *   kept, on the row that now has two things to join; the name is left alone on its own line, which
 *   is what the review asked for on the classic card.
 * - **Allergens moved onto the photograph**, as labelled pills, from a chip row in the body.
 * - **Details moved inside the description**, floated to the end of its clipped last line, and out
 *   of the action row — where it had been competing with Add for the same corner.
 * - **The order-type band arrived**, and craft's saffron reason tape is hidden while blocked so the
 *   restriction is not written twice. The tape survives for the `info` tone, where it is the only
 *   thing carrying the fact.
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
        // The band craft never had. Shared component, shared geometry — a diagonal on a card, a
        // caption on a phone thumbnail — because it is a statement about the ORDER CHANNEL, not
        // about the template, and a craft guest was the only one who could not see it at a glance.
        badge={
          isBlocked && availabilityNotice ? (
            <OrderTypeRibbon label={availabilityNotice.message} compactLabel={availabilityNotice.shortMessage} />
          ) : undefined
        }
        // Allergens on the photograph rather than as a chip row in the body.
        overlay={
          <AllergenDisplay allergens={item.allergens} id={`craft-allergen-${item.id}`} maxVisible={2} variant="photo" />
        }
        onError={() => setImageFailed(true)}
      />

      <div className={styles.body}>
        {/* The name, alone. It was the first half of a `name ..... price` dotted leader; the leader
            is the FOOT row now, joining the price to the add control. */}
        <button type="button" className={styles.nameButton} onClick={openDetails} id={nameId}>
          {/* product-authored text: dir="auto" so an English name inside an Arabic page keeps its own punctuation (DESIGN-SYSTEM.md §8.2) */}
          <span dir="auto" className={styles.name}>
            {itemName}
          </span>
        </button>

        {/* Details floated onto the end of the description's clipped last line — the classic card's
            placement, in craft's kraft lettering. It has to be FIRST in source order: a float is
            only wrapped by the content that follows it. */}
        {description ? (
          <p dir="auto" className={styles.description}>
            <button type="button" className={styles.detailsLink} onClick={openDetails}>
              {t('details', 'Details')}
            </button>
            {/* No wrapper span. Classic's hero wraps its description text so the ≤600px rule can
                hide the TEXT without hiding the paragraph that hosts the Details link; craft never
                hides either, at any width, so a wrapper here would be a class that no craft module
                declares — i.e. a reference that reads as intentional and does nothing. */}
            {description}
          </p>
        ) : (
          <button type="button" className={styles.detailsButton} onClick={openDetails}>
            {t('details', 'Details')}
          </button>
        )}

        {bundleIncludes && (
          <p dir="auto" className={styles.includes}>
            {bundleIncludes}
          </p>
        )}

        {/* An `info` notice keeps craft's saffron tape in the body — nothing else is carrying that
            fact. The blocked one moves into the foot, where its switch link stands in for the
            removed Add and the two states come out the same height. */}
        {availabilityNotice && !isBlocked && (
          <MenuCardAvailability
            notice={availabilityNotice}
            reasonId={reasonId}
            onSwitchOrderType={onSwitchOrderType}
            styles={availabilityStyles}
          />
        )}

        {/* The dotted leader, in its new place: price ..... action. */}
        <div className={styles.foot}>
          <span className={styles.price}>
            {/* "from CHF 6.00" when the base row is hidden — same rule as the classic card (F2). */}
            {cardPriceText(price, item.priceIsFrom, t)}
            <AdminPriceEditor item={item} onPriceChange={setPrice} />
          </span>

          {/* Keyed on `isBlocked` alone — see the shared card for why `isBlocked && notice` would
              put a live Add on an item the server has already refused. "Add" is dropped while
              blocked, never rendered disabled. */}
          {isBlocked ? (
            availabilityNotice && (
              <MenuCardAvailability
                notice={availabilityNotice}
                reasonId={reasonId}
                onSwitchOrderType={onSwitchOrderType}
                styles={availabilityStyles}
              />
            )
          ) : (
            <button
              type="button"
              className={styles.addButton}
              onClick={open}
              aria-label={t('add_item_to_order', { itemName })}
            >
              <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
              {t('add')}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

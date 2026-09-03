'use client';

import { ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPlainCurrency } from '@/utils/currency';
import type { SuggestedSideGroupDefinition } from '@/utils/suggestedSideItems';
import type { SuggestedSideItem } from '@/types/menu';
import styles from './SuggestedSideItemsSection.module.css';
import disclosureStyles from './SuggestedSideItemGroup.module.css';

interface SuggestedSideItemGroupProps {
  group: SuggestedSideGroupDefinition<SuggestedSideItem>;
  selectedSideItems: Array<{ id: string; quantity: number }>;
  onAdd: (sideItemId: string) => void;
  onRemove: (sideItemId: string) => void;
  /**
   * `bare` is what the guided flow's per-partition step renders: always open, and WITHOUT the
   * group's own `<h3>`, because the step panel's title already names the partition ("Add a
   * dessert") and the two said the same thing twice. Same rule, same word, as `VariationsSection`'s
   * `headless`.
   *
   * `plain` is the same group WITH its heading — the fallback for a `sides` step that somehow
   * carries no `sideGroup`, where all three partitions render and each needs naming.
   *
   * `disclosure` (the default) is the collapsed group the pre-flow scrolling sheet used. It has had
   * no production caller since the guided flow shipped; it is kept because it is the default of a
   * prop the flow may yet want back, and removing it is a separate change from this one.
   */
  variant?: 'disclosure' | 'plain' | 'bare';
}

/**
 * One optional side group. Collapsed on first open so a long drinks or desserts list cannot make
 * the sheet scroll past its primary action; choosing still uses the parent's exact same payload.
 */
export default function SuggestedSideItemGroup({
  group,
  selectedSideItems,
  onAdd,
  onRemove,
  variant = 'disclosure',
}: Readonly<SuggestedSideItemGroupProps>) {
  const { t } = useTranslation();
  const hasPreselectedItem = group.items.some((sideItem) =>
    selectedSideItems.some((selectedItem) => selectedItem.id === sideItem.id && selectedItem.quantity > 0),
  );
  // Required sides are seeded by the sheet state. Keep their name, price and required marker visible
  // on first render instead of hiding a paid selection behind a collapsed disclosure.
  const isPlain = variant === 'plain' || variant === 'bare';
  const [isOpen, setIsOpen] = useState(hasPreselectedItem);
  const isExpanded = isPlain || isOpen;
  const panelId = useId();
  const quantityFor = (sideItemId: string) => selectedSideItems.find((item) => item.id === sideItemId)?.quantity ?? 0;

  return (
    <section className={styles.section}>
      {variant === 'plain' && <h3 className={styles.sectionTitle}>{t(group.translationKey)}</h3>}
      {variant === 'disclosure' && (
        <h3 className={styles.sectionTitle}>
          <button
            type="button"
            className={disclosureStyles.header}
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isExpanded}
            aria-controls={panelId}
          >
            <span className={disclosureStyles.headerText}>
              <span>{t(group.translationKey)}</span>
              <span className={disclosureStyles.summary}>{t('select_options')}</span>
            </span>
            {isExpanded ? <ChevronUp size={20} aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
          </button>
        </h3>
      )}

      {isExpanded && (
        <div id={panelId} className={styles.sideItemsList}>
          {group.items.map((sideItem) => (
            <SuggestedSideItemRow
              key={sideItem.id}
              sideItem={sideItem}
              quantity={quantityFor(sideItem.id)}
              onAdd={onAdd}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface SuggestedSideItemRowProps {
  sideItem: SuggestedSideItem;
  quantity: number;
  onAdd: (sideItemId: string) => void;
  onRemove: (sideItemId: string) => void;
}

function SuggestedSideItemRow({ sideItem, quantity, onAdd, onRemove }: Readonly<SuggestedSideItemRowProps>) {
  const { t } = useTranslation();
  const isSelected = quantity > 0;

  return (
    <div className={styles.sideItem}>
      <div className={styles.sideItemInfo}>
        <h4 className={styles.sideItemName}>
          <span dir="auto">{sideItem.name}</span>
          {sideItem.isRequired && (
            <span className={styles.requiredMarker} aria-label={t('required')}>
              *
            </span>
          )}
        </h4>
        {sideItem.description && (
          <p dir="auto" className={styles.sideItemDescription}>
            {sideItem.description}
          </p>
        )}
        <span className={styles.sideItemPrice}>{formatPlainCurrency(sideItem.price)}</span>
      </div>

      <div className={styles.sideItemActions}>
        {isSelected ? (
          <div className={styles.quantityControl}>
            <button
              onClick={() => onRemove(sideItem.id)}
              className={styles.quantityButton}
              aria-label={t('decrease_quantity')}
              type="button"
            >
              <Minus size={16} />
            </button>
            <span className={styles.quantity}>{quantity}</span>
            <button
              onClick={() => onAdd(sideItem.id)}
              className={styles.quantityButton}
              aria-label={t('increase_quantity')}
              type="button"
            >
              <Plus size={16} />
            </button>
          </div>
        ) : (
          <button onClick={() => onAdd(sideItem.id)} className={styles.addButton} type="button">
            {t('add_ingredient')}
          </button>
        )}
      </div>
    </div>
  );
}

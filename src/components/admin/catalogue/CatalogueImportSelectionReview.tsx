'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import CatalogueImportItemReview from './CatalogueImportItemReview';
import CatalogueImportPriceGrid from './CatalogueImportPriceGrid';
import type { CatalogueOptionPriceRef } from '@/hooks/admin/useCatalogueOptionPrices';
import type { CatalogueTemplateRevision } from '@/services/catalogueTemplateService';
import type {
  CatalogueImportDecision,
  CatalogueImportSession,
  CatalogueImportSessionItem,
} from '@/services/catalogueImportService';
import { catalogueImportDecisionFor } from '@/utils/catalogueImportDecision';
import styles from './CatalogueImportWorkspace.module.css';
import reviewStyles from './CatalogueImportGuidedReview.module.css';

interface Props {
  readonly session: CatalogueImportSession;
  readonly selectedIds: readonly string[];
  readonly decisions: Readonly<Record<string, CatalogueImportDecision>>;
  readonly priceRefsByOwner: Readonly<Record<string, CatalogueOptionPriceRef[]>>;
  readonly detailsByKey: Readonly<Record<string, CatalogueTemplateRevision>>;
  readonly canEditSelection: boolean;
  readonly canEditDecision: (item: CatalogueImportSessionItem) => boolean;
  readonly onToggleSelection: (item: CatalogueImportSessionItem, selected: boolean) => void;
  readonly onDecisionChange: (item: CatalogueImportSessionItem, patch: Partial<CatalogueImportDecision>) => void;
  readonly mode: 'selection' | 'details';
  readonly activeItemKey?: string;
  readonly onActiveItemChange?: (key: string) => void;
}

const keyFor = (item: CatalogueImportSessionItem) => `${item.templateId}@${item.revision}`;

export default function CatalogueImportSelectionReview(props: Props) {
  const { t } = useTranslation();
  const selectedItems = props.session.items.filter((item) => props.selectedIds.includes(item.templateId));
  const localItems = selectedItems.filter((item) => item.type !== 'cuisine-pack');
  const reviewItems =
    localItems.length > 0 &&
    !selectedItems.some((item) => item.type === 'cuisine-pack' && keyFor(item) === props.activeItemKey)
      ? localItems
      : selectedItems;
  const activeItem =
    reviewItems.find((item) => keyFor(item) === props.activeItemKey) ??
    reviewItems.find((item) => item.type === 'item' || item.type === 'bundle') ??
    reviewItems[0];
  const visibleItems =
    props.mode === 'details'
      ? activeItem
        ? [activeItem]
        : []
      : props.session.items.filter((item) => item.isRoot || item.isSelectable);
  const dependencies = props.session.items.filter((item) => !item.isRoot && !item.isSelectable);
  const priceRows = (activeItem ? [activeItem] : []).map((item) => ({
    item,
    decision: props.decisions[keyFor(item)] ?? catalogueImportDecisionFor(item),
    priceRefs: props.priceRefsByOwner[keyFor(item)] ?? [],
  }));

  return (
    <>
      <h2 className={styles.stepHeading}>
        {t(props.mode === 'selection' ? 'catalogue_import_step_offers' : 'catalogue_import_step_details')}
      </h2>
      {props.mode === 'details' && reviewItems.length > 1 && (
        <nav className={reviewStyles.reviewItemNav} aria-label={t('catalogue_import_template_items')}>
          {reviewItems.map((item) => (
            <button
              key={keyFor(item)}
              type="button"
              aria-current={item.templateId === activeItem?.templateId ? 'step' : undefined}
              onClick={() => props.onActiveItemChange?.(keyFor(item))}
            >
              {item.displayName}
            </button>
          ))}
        </nav>
      )}
      <section className={styles.itemList} aria-label={t('catalogue_import_template_items')}>
        {visibleItems.map((item) => {
          const decision = props.decisions[keyFor(item)] ?? catalogueImportDecisionFor(item);
          return (
            <CatalogueImportItemReview
              key={keyFor(item)}
              item={item}
              decision={decision}
              detail={props.detailsByKey[keyFor(item)]}
              selected={props.selectedIds.includes(item.templateId)}
              canEditSelection={props.canEditSelection}
              canEditDecision={props.canEditDecision(item)}
              onSelectedChange={(selected) => props.onToggleSelection(item, selected)}
              onDecisionChange={(patch) => props.onDecisionChange(item, patch)}
              selectionOnly={props.mode === 'selection'}
            />
          );
        })}
      </section>
      {props.mode === 'selection' && dependencies.length > 0 && (
        <details className={reviewStyles.dependencyDetails}>
          <summary>{t('catalogue_import_dependencies')}</summary>
          <ul>
            {dependencies.map((item) => (
              <li key={keyFor(item)}>{item.displayName}</li>
            ))}
          </ul>
        </details>
      )}
      {props.mode === 'details' && (
        <CatalogueImportPriceGrid
          rows={priceRows}
          canEditDecision={props.canEditDecision}
          onDecisionChange={props.onDecisionChange}
        />
      )}
    </>
  );
}

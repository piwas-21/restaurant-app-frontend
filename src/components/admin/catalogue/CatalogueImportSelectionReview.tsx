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
}

const keyFor = (item: CatalogueImportSessionItem) => `${item.templateId}@${item.revision}`;

export default function CatalogueImportSelectionReview(props: Props) {
  const { t } = useTranslation();
  const selectedItems = props.session.items.filter((item) => props.selectedIds.includes(item.templateId));
  const priceRows = selectedItems.map((item) => ({
    item,
    decision: props.decisions[keyFor(item)] ?? catalogueImportDecisionFor(item),
    priceRefs: props.priceRefsByOwner[keyFor(item)] ?? [],
  }));

  return (
    <>
      <h2 className={styles.stepHeading}>{t('catalogue_import_step_offers')}</h2>
      <section className={styles.itemList} aria-label={t('catalogue_import_template_items')}>
        {props.session.items.map((item) => {
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
            />
          );
        })}
      </section>
      <CatalogueImportPriceGrid
        rows={priceRows}
        canEditDecision={props.canEditDecision}
        onDecisionChange={props.onDecisionChange}
      />
    </>
  );
}

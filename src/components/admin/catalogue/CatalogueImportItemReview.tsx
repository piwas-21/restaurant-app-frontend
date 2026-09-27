'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import CheckboxField from '@/components/design-system/CheckboxField';
import StatusBadge from '@/components/design-system/StatusBadge';
import {
  importItemStatusLabelKey,
  type CatalogueImportDecision,
  type CatalogueImportSessionItem,
} from '@/services/catalogueImportService';
import type { CatalogueOptionPriceRef } from '@/hooks/admin/useCatalogueOptionPrices';
import CatalogueImportPriceReview from './CatalogueImportPriceReview';
import CatalogueImportOperationalReview from './CatalogueImportOperationalReview';
import styles from './CatalogueImportWorkspace.module.css';

interface Props {
  readonly item: CatalogueImportSessionItem;
  readonly decision: CatalogueImportDecision;
  readonly selected: boolean;
  readonly priceRefs: readonly CatalogueOptionPriceRef[];
  readonly onSelectedChange: (selected: boolean) => void;
  readonly onDecisionChange: (patch: Partial<CatalogueImportDecision>) => void;
}

export default function CatalogueImportItemReview({
  item,
  decision,
  selected,
  priceRefs,
  onSelectedChange,
  onDecisionChange,
}: Props) {
  const { t } = useTranslation();
  const itemIsProduct = item.type === 'item' || item.type === 'bundle';
  const statusTone = item.status === 'Imported' ? 'success' : item.status === 'Failed' ? 'danger' : 'neutral';

  return (
    <article className={styles.itemCard} aria-labelledby={`catalogue-item-${item.templateId}`}>
      <div className={styles.itemHeading}>
        <div>
          <h2 id={`catalogue-item-${item.templateId}`}>{item.displayName}</h2>
          <p>
            {t('catalogue_template_revision', { revision: item.revision })} · {t(`catalogue_type_${item.type}`)}
          </p>
        </div>
        <StatusBadge tone={statusTone}>{t(importItemStatusLabelKey(item.status))}</StatusBadge>
      </div>
      {item.isSelectable ? (
        <CheckboxField label={t('catalogue_import_include_offer')} checked={selected} onChange={onSelectedChange} />
      ) : (
        <p className={styles.locked}>
          {t(item.isRoot ? 'catalogue_import_root_locked' : 'catalogue_import_dependency_locked')}
        </p>
      )}
      {item.localEntityId && (
        <p className={styles.referenceText}>
          {t('catalogue_import_existing_mapping', { type: item.localEntityType ?? '', id: item.localEntityId })}
        </p>
      )}
      {item.description && (
        <p className={styles.referenceText}>
          {t('catalogue_import_reference_description')}: {item.description}
        </p>
      )}
      {selected && (
        <div className={styles.fields}>
          <FormField label={t('catalogue_import_resolution')}>
            <select
              value={decision.resolution}
              onChange={(event) => onDecisionChange({ resolution: event.target.value as 'Create' | 'Reuse' })}
            >
              <option value="Create">{t('catalogue_import_create_new')}</option>
              <option value="Reuse">{t('catalogue_import_reuse')}</option>
            </select>
          </FormField>
          {decision.resolution === 'Reuse' && (
            <FormField label={t('catalogue_import_local_entity_id')}>
              <input
                value={decision.localEntityId ?? item.localEntityId ?? ''}
                onChange={(event) => onDecisionChange({ localEntityId: event.target.value.trim() || undefined })}
              />
            </FormField>
          )}
          <FormField label={t('catalogue_import_local_name')}>
            <input
              value={decision.localName ?? ''}
              onChange={(event) => onDecisionChange({ localName: event.target.value })}
            />
          </FormField>
          {item.displayName && (
            <button
              type="button"
              className={styles.copyButton}
              onClick={() => onDecisionChange({ localName: item.displayName })}
            >
              {t('catalogue_import_use_suggested_name')}
            </button>
          )}
          <FormField label={t('catalogue_import_local_description')}>
            <textarea
              value={decision.localDescription ?? ''}
              onChange={(event) => onDecisionChange({ localDescription: event.target.value })}
              rows={3}
            />
          </FormField>
          {item.description && (
            <button
              type="button"
              className={styles.copyButton}
              onClick={() => onDecisionChange({ localDescription: item.description ?? '' })}
            >
              {t('catalogue_import_use_suggested_description')}
            </button>
          )}
          {itemIsProduct && (
            <CatalogueImportOperationalReview
              itemType={item.type}
              decision={decision}
              onDecisionChange={onDecisionChange}
            />
          )}
          <CatalogueImportPriceReview
            templateType={item.type}
            decision={decision}
            priceRefs={priceRefs}
            onDecisionChange={onDecisionChange}
          />
        </div>
      )}
    </article>
  );
}

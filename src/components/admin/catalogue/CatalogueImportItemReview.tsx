'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import CheckboxField from '@/components/design-system/CheckboxField';
import StatusBadge from '@/components/design-system/StatusBadge';
import {
  importItemStatusLabelKey,
  type CatalogueImportDecision,
  type CatalogueImportSessionItem,
} from '@/services/catalogueImportService';
import CatalogueImportOperationalReview from './CatalogueImportOperationalReview';
import CatalogueImportLocalMatchSearch from './CatalogueImportLocalMatchSearch';
import type { MenuAuthoringCandidate } from '@/types/menuAuthoringSearch';
import styles from './CatalogueImportWorkspace.module.css';
import itemStyles from './CatalogueImportItemReview.module.css';

interface Props {
  readonly item: CatalogueImportSessionItem;
  readonly decision: CatalogueImportDecision;
  readonly selected: boolean;
  readonly canEditSelection: boolean;
  readonly canEditDecision: boolean;
  readonly onSelectedChange: (selected: boolean) => void;
  readonly onDecisionChange: (patch: Partial<CatalogueImportDecision>) => void;
}

function statusTone(status: CatalogueImportSessionItem['status']): 'success' | 'danger' | 'neutral' {
  if (status === 'Imported') return 'success';
  if (status === 'Failed') return 'danger';
  return 'neutral';
}

export default function CatalogueImportItemReview({
  item,
  decision,
  selected,
  canEditSelection,
  canEditDecision,
  onSelectedChange,
  onDecisionChange,
}: Props) {
  const { t } = useTranslation();
  const [chosenLocal, setChosenLocal] = useState<MenuAuthoringCandidate | null>(null);
  const itemIsProduct = item.type === 'item' || item.type === 'bundle';
  const canSearchLocal = item.type === 'item' || item.type === 'bundle';
  const localName =
    chosenLocal && chosenLocal.id === decision.localEntityId
      ? chosenLocal.name
      : decision.localEntityId === (item.decision?.localEntityId ?? item.localEntityId)
        ? item.localEntityName
        : null;

  return (
    <article className={styles.itemCard} aria-labelledby={`catalogue-item-${item.templateId}`}>
      <div className={styles.itemHeading}>
        <div>
          <h2 id={`catalogue-item-${item.templateId}`}>{item.displayName}</h2>
          <p>
            {t('catalogue_template_revision', { revision: item.revision })} · {t(`catalogue_type_${item.type}`)}
          </p>
        </div>
        <StatusBadge tone={statusTone(item.status)}>{t(importItemStatusLabelKey(item.status))}</StatusBadge>
      </div>
      {item.isSelectable ? (
        <CheckboxField
          label={t('catalogue_import_include_offer')}
          checked={selected}
          disabled={!canEditSelection}
          onChange={onSelectedChange}
        />
      ) : (
        <p className={styles.locked}>
          {t(item.isRoot ? 'catalogue_import_root_locked' : 'catalogue_import_dependency_locked')}
        </p>
      )}
      {item.localEntityId && decision.resolution === 'Reuse' && (
        <p className={styles.referenceText}>{t('catalogue_import_using_existing')}</p>
      )}
      {selected && decision.resolution === 'Reuse' && decision.localEntityId && (
        <p className={styles.referenceText}>
          {localName && <strong>{localName} · </strong>}
          {t('catalogue_import_reuse_identity', { type: t(`catalogue_type_${item.type}`) })}{' '}
          <code>{decision.localEntityId}</code>
        </p>
      )}
      {item.description && (
        <p className={styles.referenceText}>
          {t('catalogue_import_reference_description')}: {item.description}
        </p>
      )}
      {selected && (
        <div className={styles.fields}>
          {canEditDecision && canSearchLocal && (
            <CatalogueImportLocalMatchSearch
              item={item}
              onChoose={(candidate) => {
                setChosenLocal(candidate);
                onDecisionChange({ resolution: 'Reuse', localEntityId: candidate.id });
              }}
            />
          )}
          {(item.localEntityId || decision.localEntityId || decision.resolution === 'Reuse') && (
            <FormField label={t('catalogue_import_resolution')}>
              <select
                value={decision.resolution}
                disabled={!canEditDecision}
                onChange={(event) => {
                  const create = event.target.value === 'Create';
                  onDecisionChange(
                    create
                      ? {
                          resolution: 'Create',
                          localName: decision.localName ?? item.displayName,
                          localDescription: decision.localDescription ?? item.description ?? '',
                        }
                      : {
                          resolution: 'Reuse',
                          localEntityId: decision.localEntityId ?? item.localEntityId ?? undefined,
                        },
                  );
                }}
              >
                <option value="Create">{t('catalogue_import_create_new')}</option>
                <option value="Reuse">{t('catalogue_import_reuse')}</option>
              </select>
            </FormField>
          )}
          {decision.resolution === 'Reuse' ? (
            <p className={styles.referenceText}>{t('catalogue_import_reuse_preserves_local')}</p>
          ) : (
            <details className={itemStyles.optionalDetails}>
              <summary>{t('catalogue_import_customize_text')}</summary>
              <FormField label={t('catalogue_import_local_name')}>
                <input
                  value={decision.localName ?? ''}
                  disabled={!canEditDecision}
                  onChange={(event) => onDecisionChange({ localName: event.target.value })}
                />
              </FormField>
              {item.displayName && (
                <button
                  type="button"
                  className={styles.copyButton}
                  disabled={!canEditDecision}
                  onClick={() => onDecisionChange({ localName: item.displayName })}
                >
                  {t('catalogue_import_use_suggested_name')}
                </button>
              )}
              <FormField label={t('catalogue_import_local_description')}>
                <textarea
                  value={decision.localDescription ?? ''}
                  disabled={!canEditDecision}
                  onChange={(event) => onDecisionChange({ localDescription: event.target.value })}
                  rows={3}
                />
              </FormField>
              {item.description && (
                <button
                  type="button"
                  className={styles.copyButton}
                  disabled={!canEditDecision}
                  onClick={() => onDecisionChange({ localDescription: item.description ?? '' })}
                >
                  {t('catalogue_import_use_suggested_description')}
                </button>
              )}
            </details>
          )}
          {itemIsProduct && (
            <CatalogueImportOperationalReview
              itemType={item.type}
              decision={decision}
              onDecisionChange={onDecisionChange}
              disabled={!canEditDecision}
            />
          )}
        </div>
      )}
    </article>
  );
}

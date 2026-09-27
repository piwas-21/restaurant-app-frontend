'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CheckboxField from '@/components/design-system/CheckboxField';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { CatalogueRevisionChanges } from '@/services/catalogueRevisionChangeService';
import styles from './CatalogueRevisionChangesReview.module.css';

interface Props {
  readonly changes: CatalogueRevisionChanges | null;
  readonly isWorking: boolean;
  readonly error: string | null;
  readonly revisionChangesError: string | null;
  readonly onApply: (item: CatalogueRevisionChanges['items'][number], fieldPaths: readonly string[]) => void;
  readonly onRetry: () => void;
}

function displayValue(value: unknown, emptyLabel: string): string {
  if (value === null || value === undefined || value === '') return emptyLabel;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function valuesMatch(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export default function CatalogueRevisionChangesReview({
  changes,
  isWorking,
  error,
  revisionChangesError,
  onApply,
  onRetry,
}: Props) {
  const { t } = useTranslation();
  const [selectedByTemplate, setSelectedByTemplate] = useState<Record<string, string[]>>({});
  const items = changes?.items ?? [];
  if (items.length === 0 && !error && !revisionChangesError) return null;
  const emptyLabel = t('catalogue_revision_empty_value');

  return (
    <section className={styles.revisionChanges} aria-labelledby="catalogue-revision-changes-heading">
      <h2 id="catalogue-revision-changes-heading">{t('catalogue_revision_changes_heading')}</h2>
      <p>{t('catalogue_revision_changes_help')}</p>
      {error && (
        <p role="alert" className={styles.error}>
          {t(error)}
        </p>
      )}
      {revisionChangesError && (
        <p role="alert" className={styles.error}>
          {t(revisionChangesError)}{' '}
          <button type="button" disabled={isWorking} onClick={onRetry}>
            {t('catalogue_retry')}
          </button>
        </p>
      )}
      {items.map((item) => {
        const key = `${item.templateId}@${item.adoptedRevision}`;
        const changedFields = item.fieldDiffs.filter((field) => !valuesMatch(field.baseline, field.current));
        const selected = (selectedByTemplate[key] ?? []).filter((path) =>
          changedFields.some((field) => field.path === path && !field.localChanged),
        );
        const unavailable = item.withdrawn || item.currentRevision == null || !item.currentContentHash;
        const statusLabel = item.withdrawn
          ? t('catalogue_revision_withdrawn')
          : unavailable
            ? t('catalogue_revision_unavailable')
            : t('catalogue_template_revision', { revision: item.currentRevision });
        const ready = !unavailable;
        return (
          <article key={key} className={styles.revisionNotice}>
            <div className={styles.revisionHeader}>
              <h3>{t('catalogue_revision_change_title', { template: item.templateId })}</h3>
              <StatusBadge tone={unavailable || item.adoptedRevisionWithdrawn ? 'warning' : 'info'}>
                {statusLabel}
              </StatusBadge>
            </div>
            <p>{item.notice}</p>
            {item.adoptedRevisionWithdrawn && <p>{t('catalogue_revision_adopted_withdrawn')}</p>}
            {changedFields.length === 0 ? (
              <p>{t('catalogue_revision_no_field_changes')}</p>
            ) : (
              <div className={styles.revisionFieldList}>
                {changedFields.map((field) => {
                  const locallyChanged = field.localChanged;
                  const checked = selected.includes(field.path);
                  return (
                    <article key={field.path} className={styles.revisionField}>
                      <CheckboxField
                        label={field.path}
                        checked={checked}
                        disabled={!ready || locallyChanged || isWorking}
                        description={locallyChanged ? t('catalogue_revision_local_change_preserved') : undefined}
                        onChange={(next) =>
                          setSelectedByTemplate((current) => {
                            const paths = current[key] ?? [];
                            return {
                              ...current,
                              [key]: next
                                ? [...new Set([...paths, field.path])]
                                : paths.filter((path) => path !== field.path),
                            };
                          })
                        }
                      />
                      <dl className={styles.revisionValues}>
                        <div>
                          <dt>{t('catalogue_revision_baseline')}</dt>
                          <dd>{displayValue(field.baseline, emptyLabel)}</dd>
                        </div>
                        <div>
                          <dt>{t('catalogue_revision_current')}</dt>
                          <dd>{displayValue(field.current, emptyLabel)}</dd>
                        </div>
                        <div>
                          <dt>{t('catalogue_revision_local')}</dt>
                          <dd>{displayValue(field.localValue, emptyLabel)}</dd>
                        </div>
                      </dl>
                    </article>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              disabled={!ready || selected.length === 0 || isWorking}
              onClick={() => onApply(item, selected)}
            >
              {t(isWorking ? 'catalogue_import_working' : 'catalogue_revision_apply_selected')}
            </button>
          </article>
        );
      })}
    </section>
  );
}

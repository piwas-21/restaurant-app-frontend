'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import {
  importItemStatusLabelKey,
  importStatusLabelKey,
  type CatalogueImportResult,
  type CatalogueRevisionChanges,
} from '@/services/catalogueImportService';
import styles from './CatalogueImportWorkspace.module.css';

export default function CatalogueImportCompletion({
  result,
  changes,
}: {
  readonly result: CatalogueImportResult;
  readonly changes: CatalogueRevisionChanges | null;
}) {
  const { t } = useTranslation();
  return (
    <section className={styles.completion} aria-labelledby="catalogue-import-complete-heading">
      <div className={styles.previewHeader}>
        <h2 id="catalogue-import-complete-heading">{t('catalogue_import_result_title')}</h2>
        <StatusBadge
          tone={result.status === 'Imported' ? 'success' : result.status === 'PartiallyImported' ? 'warning' : 'danger'}
        >
          {t(importStatusLabelKey(result.status))}
        </StatusBadge>
      </div>
      <ul className={styles.resultList}>
        {result.items.map((item) => (
          <li key={`${item.templateId}@${item.revision}`}>
            <span>
              {item.templateId}@{item.revision}
            </span>
            <StatusBadge
              tone={item.status === 'Imported' ? 'success' : item.status === 'Failed' ? 'danger' : 'neutral'}
            >
              {t(importItemStatusLabelKey(item.status))}
            </StatusBadge>
            {item.failureCode && <span>{item.failureCode}</span>}
            {item.localEntityId && /product|bundle|menu/i.test(item.localEntityType ?? '') && (
              <Link href={`/admin/menu-management/${encodeURIComponent(item.localEntityId)}`}>
                {t('catalogue_import_open_local_item')}
              </Link>
            )}
          </li>
        ))}
      </ul>
      {result.items.some((item) => item.status === 'Imported' && item.localEntityId) && (
        <aside className={styles.activationNotice}>
          <h3>{t('catalogue_import_publish_review_title')}</h3>
          <p>{t('catalogue_import_inactive_notice')}</p>
          <p>{t('catalogue_import_publish_review_steps')}</p>
        </aside>
      )}
      {changes?.items.map((item) => (
        <aside key={`${item.templateId}@${item.adoptedRevision}`} className={styles.revisionNotice}>
          <h3>{t('catalogue_revision_change_title', { template: item.templateId })}</h3>
          <p>{item.notice}</p>
          {item.fields.filter((field) => field.localChanged).length > 0 && (
            <ul>
              {item.fields
                .filter((field) => field.localChanged)
                .map((field) => (
                  <li key={field.path}>{field.path}</li>
                ))}
            </ul>
          )}
          <p>{t('catalogue_revision_change_advisory')}</p>
        </aside>
      ))}
    </section>
  );
}

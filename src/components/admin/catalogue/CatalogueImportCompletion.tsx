'use client';

import React from 'react';
import Link from '@/components/TenantLink';
import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import {
  importItemStatusLabelKey,
  importStatusLabelKey,
  type CatalogueImportResult,
} from '@/services/catalogueImportService';
import styles from './CatalogueImportWorkspace.module.css';
import CatalogueImportGuestReview from './CatalogueImportGuestReview';

function resultTone(status: CatalogueImportResult['status']): 'success' | 'warning' | 'danger' {
  if (status === 'Imported') return 'success';
  if (status === 'PartiallyImported') return 'warning';
  return 'danger';
}

function itemTone(status: CatalogueImportResult['items'][number]['status']): 'success' | 'danger' | 'neutral' {
  if (status === 'Imported') return 'success';
  if (status === 'Failed') return 'danger';
  return 'neutral';
}

export default function CatalogueImportCompletion({ result }: { readonly result: CatalogueImportResult }) {
  const { t } = useTranslation();
  const importedProducts = result.items.filter(
    (item) =>
      item.status === 'Imported' && item.localEntityId && /product|bundle|menu/i.test(item.localEntityType ?? ''),
  );
  return (
    <section className={styles.completion} aria-labelledby="catalogue-import-complete-heading">
      <div className={styles.previewHeader}>
        <h2 id="catalogue-import-complete-heading">{t('catalogue_import_result_title')}</h2>
        <StatusBadge tone={resultTone(result.status)}>{t(importStatusLabelKey(result.status))}</StatusBadge>
      </div>
      <ul className={styles.resultList}>
        {result.items.map((item) => (
          <li key={`${item.templateId}@${item.revision}`}>
            <span>
              {item.templateId}@{item.revision}
            </span>
            <StatusBadge tone={itemTone(item.status)}>{t(importItemStatusLabelKey(item.status))}</StatusBadge>
            {item.failureCode && <span>{item.failureCode}</span>}
            {item.localEntityId && /product|bundle|menu/i.test(item.localEntityType ?? '') && (
              <Link href={`/admin/menu-management/${encodeURIComponent(item.localEntityId)}`}>
                {t('catalogue_import_open_local_item')}
              </Link>
            )}
          </li>
        ))}
      </ul>
      {importedProducts.length > 0 && (
        <aside className={styles.activationNotice}>
          <h3>{t('catalogue_import_publish_review_title')}</h3>
          <p>{t('catalogue_import_inactive_notice')}</p>
          <p>{t('catalogue_import_publish_review_steps')}</p>
          <p>{t('catalogue_import_post_activation_check')}</p>
        </aside>
      )}
      {importedProducts.length > 0 && <CatalogueImportGuestReview items={importedProducts} />}
    </section>
  );
}

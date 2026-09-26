'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/admin/PageHeader';
import { LANGUAGE_CODES, type LanguageCode } from '@/config/languageConfig';
import { useCatalogueTemplateSearch } from '@/hooks/admin/useCatalogueTemplateSearch';
import type { CatalogueTemplateSummary } from '@/services/catalogueTemplateService';
import CatalogueTemplateCard from './CatalogueTemplateCard';
import CatalogueTemplateFilterBar from './CatalogueTemplateFilterBar';
import CatalogueTemplatePreviewModal from './CatalogueTemplatePreviewModal';
import styles from './CatalogueTemplateBrowser.module.css';

function resolveLocale(locale: string | undefined): LanguageCode {
  const normalized = locale?.toLowerCase();
  if (normalized && LANGUAGE_CODES.includes(normalized as LanguageCode)) return normalized as LanguageCode;
  const primary = normalized?.split('-')[0];
  if (primary && LANGUAGE_CODES.includes(primary as LanguageCode)) return primary as LanguageCode;
  return 'en';
}

export default function CatalogueTemplateBrowser() {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.resolvedLanguage || i18n.language);
  const search = useCatalogueTemplateSearch(locale);
  const { updateFilter } = search;
  const [preview, setPreview] = useState<CatalogueTemplateSummary | null>(null);

  useEffect(() => {
    updateFilter('locale', locale);
  }, [locale, updateFilter]);

  return (
    <main className={styles.page}>
      <PageHeader title={t('catalogue_title')} />
      <p className={styles.intro}>{t('catalogue_intro')}</p>
      <CatalogueTemplateFilterBar filters={search.filters} onChange={search.updateFilter} />
      {search.error && (
        <p className={styles.error} role="alert">
          {search.error}
          <button type="button" className={styles.retryButton} onClick={search.retry}>
            {t('catalogue_retry')}
          </button>
        </p>
      )}
      {search.isLoading && (
        <p className={styles.message} role="status">
          {t('catalogue_loading')}
        </p>
      )}
      {!search.isLoading && !search.error && search.templates.length === 0 && (
        <section className={styles.emptyState}>
          <h2>{t('catalogue_empty')}</h2>
          <p>{t('catalogue_empty_guidance')}</p>
        </section>
      )}
      {search.templates.length > 0 && (
        <ul className={styles.list} aria-label={t('catalogue_results')} aria-busy={search.isLoading}>
          {search.templates.map((template) => (
            <CatalogueTemplateCard
              key={`${template.templateId}@${template.revision}`}
              template={template}
              onPreview={setPreview}
              onCuisineSelect={(cuisine) => search.updateFilter('cuisine', cuisine)}
            />
          ))}
        </ul>
      )}
      {(search.hasNextPage || search.hasPreviousPage) && (
        <nav className={styles.pagination} aria-label={t('catalogue_pagination')}>
          <button
            type="button"
            className={styles.paginationButton}
            disabled={!search.hasPreviousPage || search.isLoading}
            onClick={search.goToPreviousPage}
          >
            {t('catalogue_previous_page')}
          </button>
          <span aria-live="polite">{t('catalogue_page_number', { page: search.pageNumber })}</span>
          <button
            type="button"
            className={styles.paginationButton}
            disabled={!search.hasNextPage || search.isLoading}
            onClick={search.goToNextPage}
          >
            {t('catalogue_next_page')}
          </button>
        </nav>
      )}
      <CatalogueTemplatePreviewModal
        template={preview}
        locale={search.filters.locale}
        onClose={() => setPreview(null)}
      />
    </main>
  );
}

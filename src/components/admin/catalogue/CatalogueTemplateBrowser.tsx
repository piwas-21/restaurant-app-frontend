'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/admin/PageHeader';
import { LANGUAGE_CODES, type LanguageCode } from '@/config/languageConfig';
import { useCatalogueTemplateSearch } from '@/hooks/admin/useCatalogueTemplateSearch';
import type { CatalogueTemplateSummary } from '@/services/catalogueTemplateService';
import CatalogueTemplateCard from './CatalogueTemplateCard';
import CatalogueTemplateFilterBar from './CatalogueTemplateFilterBar';
import CatalogueTemplatePreviewModal from './CatalogueTemplatePreviewModal';
import CatalogueCuisinePreferences from './CatalogueCuisinePreferences';
import type { CatalogueTemplateRevision } from '@/services/catalogueTemplateService';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = resolveLocale(i18n.resolvedLanguage || i18n.language);
  const search = useCatalogueTemplateSearch(locale);
  const { updateFilter } = search;
  const [preview, setPreview] = useState<CatalogueTemplateSummary | null>(null);
  const onboarding = searchParams.get('flow') === 'onboarding';
  const onboardingFilterApplied = useRef(false);

  useEffect(() => {
    updateFilter('locale', locale);
  }, [locale, updateFilter]);

  useEffect(() => {
    if (onboarding && !onboardingFilterApplied.current) {
      onboardingFilterApplied.current = true;
      updateFilter('type', 'cuisine-pack');
    }
  }, [onboarding, updateFilter]);

  const applyCuisineDefaults = useCallback(
    (cuisines: string[]) => {
      if (!search.filters.cuisine && cuisines.length > 0) updateFilter('cuisine', cuisines[0]);
    },
    [search.filters.cuisine, updateFilter],
  );

  const startImport = useCallback(
    (detail: CatalogueTemplateRevision, createNewCopy: boolean) => {
      const params = new URLSearchParams({
        templateId: detail.templateId,
        revision: String(detail.revision),
        locale,
        createNewCopy: String(createNewCopy),
      });
      if (detail.type === 'cuisine-pack') {
        for (const offer of detail.payload.offers.filter((item) => item.includedByDefault)) {
          params.append('selected', offer.templateId);
        }
      }
      router.push(`/admin/menu-management/catalogue/import?${params.toString()}`);
    },
    [locale, router],
  );

  return (
    <main className={styles.page}>
      <PageHeader title={t(onboarding ? 'catalogue_build_menu_title' : 'catalogue_title')} />
      <p className={styles.intro}>{t(onboarding ? 'catalogue_build_menu_intro' : 'catalogue_intro')}</p>
      <CatalogueCuisinePreferences onPreferencesLoaded={applyCuisineDefaults} />
      <CatalogueTemplateFilterBar filters={search.filters} onChange={search.updateFilter} />
      {search.error && (
        <p className={styles.error} role="alert">
          {search.error}
          <button type="button" className={styles.retryButton} onClick={search.retry}>
            {t('catalogue_retry')}
          </button>
        </p>
      )}
      {search.isLoading && <output className={styles.message}>{t('catalogue_loading')}</output>}
      {!search.isLoading && !search.error && search.templates.length === 0 && (
        <section className={styles.emptyState}>
          <h2>{t('catalogue_empty')}</h2>
          <p>{t('catalogue_empty_guidance')}</p>
          <Link href="/admin/menu-management" className={styles.previewButton}>
            {t('catalogue_manual_creation_link')}
          </Link>
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
        onStartImport={startImport}
      />
    </main>
  );
}

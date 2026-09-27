'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_CODES, type LanguageCode } from '@/config/languageConfig';
import { useMenuCatalogueSuggestions } from '@/hooks/admin/useMenuCatalogueSuggestions';
import {
  CATALOGUE_TYPE_LABEL_KEYS,
  type CatalogueTemplateRevision,
  type CatalogueTemplateSummary,
} from '@/services/catalogueTemplateService';
import CatalogueTemplatePreviewModal from '@/components/admin/catalogue/CatalogueTemplatePreviewModal';
import styles from './MenuCatalogueSuggestions.module.css';

function resolveLocale(value: string | undefined): LanguageCode {
  const normalized = value?.toLowerCase();
  if (normalized && LANGUAGE_CODES.includes(normalized as LanguageCode)) return normalized as LanguageCode;
  const primary = normalized?.split('-')[0];
  return primary && LANGUAGE_CODES.includes(primary as LanguageCode) ? (primary as LanguageCode) : 'en';
}

export default function MenuCatalogueSuggestions({ query }: { readonly query: string }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const locale = resolveLocale(i18n.resolvedLanguage || i18n.language);
  const suggestions = useMenuCatalogueSuggestions(query, locale);
  const [preview, setPreview] = useState<CatalogueTemplateSummary | null>(null);
  const startImport = useCallback(
    (detail: CatalogueTemplateRevision, createNewCopy: boolean) => {
      const params = new URLSearchParams({
        templateId: detail.templateId,
        revision: String(detail.revision),
        locale,
        createNewCopy: String(createNewCopy),
      });
      router.push(`/admin/menu-management/catalogue/import?${params.toString()}`);
    },
    [locale, router],
  );

  if (!suggestions.isVisible) return null;
  return (
    <section className={styles.panel} aria-labelledby="menu-catalogue-suggestions-heading">
      <div className={styles.heading}>
        <h2 id="menu-catalogue-suggestions-heading">{t('menu_catalogue_suggestions_title')}</h2>
        <p>{t('menu_catalogue_suggestions_help')}</p>
      </div>
      {suggestions.error && (
        <div className={styles.error} role="alert">
          <span>{t(suggestions.error)}</span>
          <button type="button" onClick={suggestions.retry}>
            {t('catalogue_retry')}
          </button>
        </div>
      )}
      {suggestions.isLoading && <output>{t('catalogue_loading')}</output>}
      {!suggestions.isLoading && !suggestions.error && suggestions.templates.length === 0 && (
        <p className={styles.empty}>{t('menu_catalogue_suggestions_empty')}</p>
      )}
      {suggestions.templates.length > 0 && (
        <ul
          className={styles.list}
          aria-label={t('menu_catalogue_suggestions_title')}
          aria-busy={suggestions.isLoading}
        >
          {suggestions.templates.map((template) => (
            <li key={`${template.templateId}@${template.revision}`} className={styles.card}>
              <div>
                <h3>{template.displayName}</h3>
                <p>
                  {t(CATALOGUE_TYPE_LABEL_KEYS[template.type])} ·{' '}
                  {t('catalogue_template_revision', { revision: template.revision })}
                </p>
                {template.cuisines.length > 0 && <p>{template.cuisines.join(', ')}</p>}
              </div>
              <button type="button" onClick={() => setPreview(template)}>
                {t('catalogue_preview')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <CatalogueTemplatePreviewModal
        template={preview}
        locale={locale}
        onClose={() => setPreview(null)}
        onStartImport={startImport}
      />
    </section>
  );
}

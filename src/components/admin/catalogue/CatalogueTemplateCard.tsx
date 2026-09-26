'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { CATALOGUE_TYPE_LABEL_KEYS, type CatalogueTemplateSummary } from '@/services/catalogueTemplateService';
import { getLanguageNativeName } from '@/config/languageConfig';
import styles from './CatalogueTemplateBrowser.module.css';

interface CatalogueTemplateCardProps {
  readonly template: CatalogueTemplateSummary;
  readonly onPreview: (template: CatalogueTemplateSummary) => void;
  readonly onCuisineSelect: (cuisine: string) => void;
}

export default function CatalogueTemplateCard({ template, onPreview, onCuisineSelect }: CatalogueTemplateCardProps) {
  const { t } = useTranslation();

  return (
    <li className={styles.card}>
      <div className={styles.cardContent}>
        <div className={styles.cardTitleRow}>
          <h2>{template.displayName}</h2>
          <span className={styles.typeBadge}>{t(CATALOGUE_TYPE_LABEL_KEYS[template.type])}</span>
        </div>
        {template.cuisines.length > 0 && (
          <div>
            <p className={styles.tagLabel}>{t('catalogue_cuisine_tags')}</p>
            <ul className={styles.tagList}>
              {template.cuisines.map((cuisine) => (
                <li key={cuisine}>
                  <button type="button" className={styles.tagButton} onClick={() => onCuisineSelect(cuisine)}>
                    {cuisine}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className={styles.metadata}>
          {t('catalogue_template_revision', { revision: template.revision })}
          {' · '}
          {t('catalogue_reviewed_translation_count', { count: template.reviewedTranslationLocales.length })}
          {' · '}
          {t('catalogue_dependency_count', { count: template.dependencyCount })}
        </p>
        {template.usedSourceFallback && (
          <p className={styles.fallbackNote}>
            {t('catalogue_source_fallback', { language: getLanguageNativeName(template.sourceLocale) })}
          </p>
        )}
      </div>
      <button type="button" className={styles.previewButton} onClick={() => onPreview(template)}>
        {t('catalogue_preview')}
      </button>
    </li>
  );
}

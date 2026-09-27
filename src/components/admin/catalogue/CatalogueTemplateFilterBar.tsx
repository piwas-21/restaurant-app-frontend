'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@/config/languageConfig';
import {
  CATALOGUE_TEMPLATE_TYPES,
  CATALOGUE_TYPE_LABEL_KEYS,
  type CatalogueTemplateType,
} from '@/services/catalogueTemplateService';
import type { CatalogueTemplateFilters } from '@/hooks/admin/useCatalogueTemplateSearch';
import styles from './CatalogueTemplateBrowser.module.css';

interface CatalogueTemplateFilterBarProps {
  readonly filters: CatalogueTemplateFilters;
  readonly onChange: <K extends keyof CatalogueTemplateFilters>(key: K, value: CatalogueTemplateFilters[K]) => void;
}

export default function CatalogueTemplateFilterBar({ filters, onChange }: CatalogueTemplateFilterBarProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.filters}>
      <FormField label={t('search')}>
        <input
          type="search"
          value={filters.query}
          onChange={(event) => onChange('query', event.target.value)}
          className={styles.filterInput}
          autoComplete="off"
        />
      </FormField>
      <FormField label={t('catalogue_filter_type')}>
        <select
          value={filters.type}
          onChange={(event) => onChange('type', event.target.value as CatalogueTemplateType | '')}
          className={styles.filterInput}
        >
          <option value="">{t('all')}</option>
          {CATALOGUE_TEMPLATE_TYPES.map((type) => (
            <option value={type} key={type}>
              {t(CATALOGUE_TYPE_LABEL_KEYS[type])}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label={t('catalogue_filter_cuisine')}>
        <input
          type="search"
          value={filters.cuisine}
          onChange={(event) => onChange('cuisine', event.target.value)}
          className={styles.filterInput}
          autoComplete="off"
        />
      </FormField>
      <FormField label={t('catalogue_filter_locale')}>
        <select
          value={filters.locale}
          onChange={(event) => onChange('locale', event.target.value as LanguageCode)}
          className={styles.filterInput}
        >
          {SUPPORTED_LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>
              {language.nativeName}
            </option>
          ))}
        </select>
      </FormField>
    </div>
  );
}

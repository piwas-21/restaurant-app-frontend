'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Category } from '@/app/admin/menu-management/interfaces';
import { MENU_TYPE_FILTERS, MENU_TYPE_FILTER_LABEL_KEYS, type MenuTypeFilter } from '@/utils/productTypeFilter';
import styles from './MenuManagementToolbar.module.css';

interface Props {
  readonly typeFilter: MenuTypeFilter;
  readonly onTypeChange: (filter: MenuTypeFilter) => void;
  readonly categories: Category[];
  readonly selectedCategoryId: string | null;
  readonly onCategoryChange: React.ChangeEventHandler<HTMLSelectElement>;
  readonly searchQuery: string;
  readonly onSearchChange: (query: string) => void;
}

export default function MenuManagementToolbar({
  typeFilter,
  onTypeChange,
  categories,
  selectedCategoryId,
  onCategoryChange,
  searchQuery,
  onSearchChange,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className={styles.toolbar}>
      <fieldset className={styles.types}>
        <legend className="sr-only">{t('product_type')}</legend>
        {MENU_TYPE_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            aria-pressed={typeFilter === filter}
            className={typeFilter === filter ? styles.selected : styles.typeButton}
            onClick={() => onTypeChange(filter)}
          >
            {t(MENU_TYPE_FILTER_LABEL_KEYS[filter])}
          </button>
        ))}
      </fieldset>
      <div className={styles.filters}>
        <label className={styles.filter}>
          <span>{t('category')}</span>
          <select onChange={onCategoryChange} value={selectedCategoryId || 'all'}>
            <option value="all">{t('all_categories_nav')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className={`${styles.filter} ${styles.search}`}>
          <span>{t('search')}</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('search')}
          />
        </label>
      </div>
    </div>
  );
}

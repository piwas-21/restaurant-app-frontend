'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import StatusBadge from '@/components/design-system/StatusBadge';
import { useMenuAuthoringSearch } from '@/hooks/admin/useMenuAuthoringSearch';
import type { MenuAuthoringCandidate } from '@/types/menuAuthoringSearch';
import type { CatalogueImportSessionItem } from '@/services/catalogueImportService';
import styles from './CatalogueImportItemReview.module.css';

interface Props {
  readonly item: CatalogueImportSessionItem;
  readonly onChoose: (candidate: MenuAuthoringCandidate) => void;
}

function matchesType(item: CatalogueImportSessionItem, candidate: MenuAuthoringCandidate): boolean {
  if (item.type === 'item') return candidate.type === 'product' || candidate.type === 'component';
  if (item.type === 'bundle') return candidate.type === 'bundle';
  return false;
}

export default function CatalogueImportLocalMatchSearch({ item, onChoose }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const search = useMenuAuthoringSearch();
  const candidates = search.items.filter((candidate) => matchesType(item, candidate));

  return (
    <div className={styles.localSearch}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          if (!open && !search.query) search.setQuery(item.displayName);
          setOpen((current) => !current);
        }}
      >
        {t('catalogue_import_find_local')}
      </button>
      {open && (
        <div className={styles.localSearchPanel}>
          <p>{t('catalogue_import_find_local_help')}</p>
          <FormField label={t('catalogue_import_find_local')}>
            <input
              type="search"
              value={search.query}
              onChange={(event) => search.setQuery(event.target.value)}
              maxLength={120}
            />
          </FormField>
          {search.query.trim().length < 2 && <output>{t('menu_authoring_search_minimum')}</output>}
          {search.isLoading && <output>{t('loading')}</output>}
          {search.error && (
            <p role="alert">
              {t(search.error)}{' '}
              <button type="button" onClick={search.retry}>
                {t('retry')}
              </button>
            </p>
          )}
          {!search.isLoading &&
            !search.error &&
            !search.nextCursor &&
            search.query.trim().length >= 2 &&
            candidates.length === 0 && <output>{t('menu_authoring_search_empty')}</output>}
          <ul>
            {candidates.map((candidate) => (
              <li key={`${candidate.type}:${candidate.id}`}>
                <div>
                  <strong>{candidate.name}</strong>
                  {candidate.categoryName && <span> · {candidate.categoryName}</span>}
                  <StatusBadge tone={candidate.isActive && candidate.isAvailable ? 'success' : 'warning'} size="sm">
                    {t(candidate.isActive && candidate.isAvailable ? 'active' : 'inactive')}
                  </StatusBadge>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onChoose(candidate);
                    setOpen(false);
                  }}
                >
                  {t('catalogue_import_use_local')}
                </button>
              </li>
            ))}
          </ul>
          {search.nextCursor && (
            <button type="button" disabled={search.isLoadingMore} onClick={() => void search.loadMore()}>
              {t(search.isLoadingMore ? 'loading' : 'load_more')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

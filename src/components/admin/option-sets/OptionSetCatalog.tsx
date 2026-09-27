'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/admin/PageHeader';
import StatusBadge from '@/components/design-system/StatusBadge';
import { OPTION_SET_KINDS } from '@/types/optionSet';
import type { OptionSetKind } from '@/types/optionSet';
import { OPTION_SET_KIND_LABEL_KEYS } from '@/utils/optionSetLabels';
import { useOptionSetCatalog } from '@/hooks/admin/useOptionSetCatalog';
import styles from './OptionSetCatalog.module.css';

export default function OptionSetCatalog() {
  const { t } = useTranslation();
  const catalog = useOptionSetCatalog();

  return (
    <main>
      <PageHeader title={t('option_sets_title')}>
        <div className={styles.pageActions}>
          <Link href="/admin/option-sets/new">{t('option_sets_new')}</Link>
        </div>
      </PageHeader>
      <p>{t('option_sets_description')}</p>
      <div className={styles.searchControls}>
        <input
          type="search"
          value={catalog.query}
          onChange={(event) => catalog.setQuery(event.target.value)}
          aria-label={t('option_sets_search')}
          placeholder={t('option_sets_search')}
        />
        <select
          value={catalog.kind}
          onChange={(event) => catalog.setKind(event.target.value as OptionSetKind | '')}
          aria-label={t('option_sets_kind_filter')}
        >
          <option value="">{t('option_sets_kind_filter')}</option>
          {OPTION_SET_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(OPTION_SET_KIND_LABEL_KEYS[kind])}
            </option>
          ))}
        </select>
      </div>
      {catalog.isLoading && <output>{t('loading')}</output>}
      {catalog.error && (
        <p className={styles.error} role="alert">
          {t(catalog.error)}{' '}
          <button type="button" onClick={() => void catalog.retry()}>
            {t('retry')}
          </button>
        </p>
      )}
      {!catalog.isLoading && !catalog.error && catalog.items.length === 0 && (
        <p className={styles.message}>{t('option_sets_empty')}</p>
      )}
      <ul className={styles.list}>
        {catalog.items.map((set) => (
          <li className={styles.row} key={set.id}>
            <div>
              <Link href={`/admin/option-sets/${encodeURIComponent(set.id)}`} className={styles.rowLink}>
                {set.name}
              </Link>
              <div className={styles.meta}>
                <span>{t(OPTION_SET_KIND_LABEL_KEYS[set.kind])}</span>
                <span>{t('option_sets_entries_count', { count: set.entryCount })}</span>
                <span>{t('option_sets_attachments_count', { count: set.attachmentCount })}</span>
                <span>{t('option_set_version', { version: set.version })}</span>
              </div>
            </div>
            <div className={styles.actions}>
              <StatusBadge tone={set.status === 'active' ? 'success' : 'neutral'}>
                {t(set.status === 'active' ? 'active' : 'archived')}
              </StatusBadge>
            </div>
          </li>
        ))}
      </ul>
      {catalog.nextCursor && (
        <button
          type="button"
          className={styles.loadMore}
          disabled={catalog.isLoadingMore}
          onClick={() => void catalog.loadMore()}
        >
          {t(catalog.isLoadingMore ? 'loading' : 'load_more')}
        </button>
      )}
    </main>
  );
}

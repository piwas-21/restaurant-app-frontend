'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/admin/PageHeader';
import FormField from '@/components/design-system/FormField';
import StatusBadge from '@/components/design-system/StatusBadge';
import { OPTION_SET_KINDS } from '@/types/optionSet';
import type { OptionSetKind } from '@/types/optionSet';
import { OPTION_SET_KIND_LABEL_KEYS } from '@/utils/optionSetLabels';
import { useOptionSetCatalog } from '@/hooks/admin/useOptionSetCatalog';
import styles from './OptionSetCatalog.module.css';
import startStyles from './OptionSetCatalogStart.module.css';

/** @t-keys-table */
const KIND_HELP_KEYS: Record<OptionSetKind, string> = {
  ingredient: 'option_sets_kind_help_ingredient',
  sauce: 'option_sets_kind_help_sauce',
  bundleChoice: 'option_sets_kind_help_bundle_choice',
  suggestedSide: 'option_sets_kind_help_suggested_side',
};

export default function OptionSetCatalog() {
  const { t } = useTranslation();
  const catalog = useOptionSetCatalog();
  const isFirstEmptyState = !catalog.query.trim() && !catalog.kind;

  return (
    <main className={styles.page}>
      <PageHeader title={t('option_sets_title')} />
      <p className={styles.intro}>{t('option_sets_description')}</p>
      <section className={startStyles.startSection} aria-labelledby="option-sets-start-heading">
        <div className={startStyles.startIntro}>
          <h2 id="option-sets-start-heading">{t('option_sets_start_heading')}</h2>
          <p>{t('option_sets_start_help')}</p>
        </div>
        <div className={startStyles.kindLinks}>
          {OPTION_SET_KINDS.map((kind) => (
            <Link key={kind} href={`/admin/option-sets/new?kind=${kind}`} className={startStyles.kindLink}>
              <span className={startStyles.kindTitle}>{t(OPTION_SET_KIND_LABEL_KEYS[kind])}</span>
              <span className={startStyles.kindHelp}>{t(KIND_HELP_KEYS[kind])}</span>
              <span className={startStyles.kindAction}>{t('create')}</span>
            </Link>
          ))}
        </div>
      </section>
      <section className={styles.savedSection} aria-labelledby="option-sets-saved-heading">
        <h2 id="option-sets-saved-heading">{t('option_sets_saved_heading')}</h2>
        <div className={styles.searchControls}>
          <FormField label={t('option_sets_search')}>
            <input
              type="search"
              value={catalog.query}
              onChange={(event) => catalog.setQuery(event.target.value)}
              placeholder={t('option_sets_search')}
            />
          </FormField>
          <FormField label={t('option_sets_kind_filter')}>
            <select
              value={catalog.kind}
              onChange={(event) => catalog.setKind(event.target.value as OptionSetKind | '')}
            >
              <option value="">{t('option_sets_kind_filter')}</option>
              {OPTION_SET_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(OPTION_SET_KIND_LABEL_KEYS[kind])}
                </option>
              ))}
            </select>
          </FormField>
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
          <p className={styles.message}>{t(isFirstEmptyState ? 'option_sets_empty_first' : 'option_sets_empty')}</p>
        )}
        {catalog.items.length > 0 && (
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
                  </div>
                </div>
                <div className={styles.actions}>
                  <StatusBadge tone={set.status === 'active' ? 'success' : 'neutral'}>
                    {t(set.status === 'active' ? 'active' : 'archived')}
                  </StatusBadge>
                  <Link href={`/admin/option-sets/${encodeURIComponent(set.id)}`}>{t('edit')}</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
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
      </section>
    </main>
  );
}

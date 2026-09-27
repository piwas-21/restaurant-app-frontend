'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import { useMenuAuthoringSearch } from '@/hooks/admin/useMenuAuthoringSearch';
import { getOptionSetTargetProduct } from '@/services/optionSetTargetService';
import type { MenuAuthoringCandidate } from '@/types/menuAuthoringSearch';
import type { OptionSetKind } from '@/types/optionSet';
import { getErrorMessage } from '@/utils/apiClient';
import styles from './OptionSetAttachmentTargetPicker.module.css';

interface Props {
  readonly kind: OptionSetKind;
  readonly onAdd: (product: Awaited<ReturnType<typeof getOptionSetTargetProduct>>) => boolean;
}

function isTargetCandidate(candidate: MenuAuthoringCandidate): boolean {
  return (
    (candidate.type === 'product' || candidate.type === 'bundle') &&
    candidate.isActive &&
    candidate.isAvailable &&
    !candidate.isComponent
  );
}

export default function OptionSetAttachmentTargetPicker({ kind, onAdd }: Props) {
  const { t } = useTranslation();
  const search = useMenuAuthoringSearch();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const candidates = search.items.filter(isTargetCandidate);

  const choose = async (candidate: MenuAuthoringCandidate) => {
    setLoadingId(candidate.id);
    setError(null);
    setNotice(null);
    try {
      const product = await getOptionSetTargetProduct(candidate.id);
      if (!product.isActive || !product.isAvailable || product.isComponent) {
        setError('option_set_target_unavailable');
        return;
      }
      if (kind === 'bundleChoice' && !product.menuDefinition?.sections.length && !product.customizationGroups?.length) {
        setNotice('option_set_target_has_no_choice_groups');
        return;
      }
      setNotice(onAdd(product) ? 'option_set_target_added' : 'option_set_target_already_attached');
    } catch (loadError) {
      setError(getErrorMessage(loadError) ?? 'option_set_target_load_error');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <section className={styles.picker} aria-labelledby="option-set-target-search-heading">
      <h3 id="option-set-target-search-heading">{t('option_set_target_search_title')}</h3>
      <p>{t(kind === 'bundleChoice' ? 'option_set_bundle_target_help' : 'option_set_target_help')}</p>
      <FormField label={t('option_set_target_search')}>
        <input
          type="search"
          value={search.query}
          maxLength={120}
          onChange={(event) => search.setQuery(event.target.value)}
        />
      </FormField>
      {search.query.trim().length < 2 && (
        <output className={styles.message}>{t('menu_authoring_search_minimum')}</output>
      )}
      {search.isLoading && <output className={styles.message}>{t('loading')}</output>}
      {search.error && (
        <p role="alert" className={styles.error}>
          {t(search.error)}{' '}
          <button type="button" onClick={search.retry}>
            {t('retry')}
          </button>
        </p>
      )}
      {!search.isLoading && search.query.trim().length >= 2 && candidates.length === 0 && !search.error && (
        <output className={styles.message}>{t('menu_authoring_search_empty')}</output>
      )}
      {(error || notice) && (
        <output className={error ? styles.error : styles.message}>{t(error ?? notice ?? '')}</output>
      )}
      <ul className={styles.candidates}>
        {candidates.map((candidate) => (
          <li key={`${candidate.type}-${candidate.id}`}>
            <span>
              {candidate.name}
              {candidate.categoryName ? ` · ${candidate.categoryName}` : ''}
            </span>
            <button type="button" disabled={loadingId !== null} onClick={() => void choose(candidate)}>
              {loadingId === candidate.id ? t('loading') : t('option_set_target_add')}
            </button>
          </li>
        ))}
      </ul>
      {search.nextCursor && (
        <button type="button" disabled={search.isLoadingMore} onClick={() => void search.loadMore()}>
          {t(search.isLoadingMore ? 'loading' : 'load_more')}
        </button>
      )}
    </section>
  );
}

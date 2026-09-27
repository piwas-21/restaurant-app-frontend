'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import StatusBadge from '@/components/design-system/StatusBadge';
import { recordMenuAuthoringMatchDecision } from '@/services/menuAuthoringSearchService';
import { getErrorMessage } from '@/utils/apiClient';
import type { MenuAuthoringCandidate } from '@/types/menuAuthoringSearch';
import type { OptionSetKind } from '@/types/optionSet';
import { useMenuAuthoringSearch } from '@/hooks/admin/useMenuAuthoringSearch';
import styles from './OptionSetReferenceSearch.module.css';

interface Props {
  readonly kind: OptionSetKind;
  readonly selectedId?: string;
  readonly selectedName: string;
  readonly selectedAvailable: boolean;
  readonly usedReferences: readonly string[];
  readonly onSelect: (candidate: MenuAuthoringCandidate) => void;
  readonly onClear: () => void;
}

function validReference(kind: OptionSetKind, candidate: MenuAuthoringCandidate): boolean {
  if (kind === 'ingredient' || kind === 'sauce') return candidate.type === 'ingredient';
  if (kind === 'suggestedSide') return candidate.type === 'product';
  return candidate.type === 'product' || candidate.type === 'component';
}

export default function OptionSetReferenceSearch({
  kind,
  selectedId,
  selectedName,
  selectedAvailable,
  usedReferences,
  onSelect,
  onClear,
}: Props) {
  const { t } = useTranslation();
  const search = useMenuAuthoringSearch(kind);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionSaved, setDecisionSaved] = useState(false);
  const candidates = search.items.filter((candidate) => validReference(kind, candidate));

  const recordDecision = async (candidate: MenuAuthoringCandidate, decision: 'accept' | 'reject') => {
    try {
      setDecisionError(null);
      await recordMenuAuthoringMatchDecision({
        query: search.query.trim(),
        candidateType: candidate.type,
        candidateId: candidate.id,
        decision,
        ...(decision === 'accept' ? { alias: search.query.trim() } : {}),
      });
      setDecisionSaved(true);
      await search.retry();
    } catch (requestError) {
      setDecisionError(getErrorMessage(requestError) ?? 'menu_authoring_decision_error');
    }
  };

  return (
    <div className={styles.search}>
      <FormField label={t('option_set_entry_reference')}>
        <input
          type="search"
          value={search.query}
          onChange={(event) => {
            setDecisionSaved(false);
            search.setQuery(event.target.value);
          }}
          maxLength={120}
          aria-describedby={selectedId && !selectedAvailable ? `option-set-reference-${selectedId}` : undefined}
        />
      </FormField>
      {selectedId && (
        <div className={styles.selected}>
          <span>{t('option_set_selected_reference', { name: selectedName })}</span>
          {!selectedAvailable && <StatusBadge tone="warning">{t('option_set_entry_unavailable')}</StatusBadge>}
          <button type="button" onClick={onClear}>
            {t('option_set_clear_reference')}
          </button>
        </div>
      )}
      {selectedId && !selectedAvailable && (
        <p id={`option-set-reference-${selectedId}`} className={styles.error}>
          {t('option_set_entry_unavailable')}
        </p>
      )}
      {search.query.trim().length < 2 && (
        <output className={styles.message}>{t('menu_authoring_search_minimum')}</output>
      )}
      {search.isLoading && <output className={styles.message}>{t('loading')}</output>}
      {search.error && (
        <p className={styles.error} role="alert">
          {t(search.error)}{' '}
          <button type="button" onClick={search.retry}>
            {t('retry')}
          </button>
        </p>
      )}
      {!search.isLoading && search.query.trim().length >= 2 && candidates.length === 0 && !search.error && (
        <output className={styles.message}>{t('menu_authoring_search_empty')}</output>
      )}
      {decisionSaved && <output className={styles.message}>{t('menu_authoring_decision_saved')}</output>}
      {decisionError && (
        <p className={styles.error} role="alert">
          {t(decisionError)}
        </p>
      )}
      <ul className={styles.candidateList}>
        {candidates.map((candidate) => {
          const duplicate = usedReferences.includes(candidate.id) && candidate.id !== selectedId;
          const canRecordAlias = search.query.trim().length >= 2 && candidate.matchSource !== 'alias';
          return (
            <li className={styles.candidate} key={`${candidate.type}-${candidate.id}`}>
              <div className={styles.candidateName}>
                <span>
                  {candidate.name}
                  {candidate.categoryName ? ` · ${candidate.categoryName}` : ''}
                </span>
                {candidate.matchSource === 'alias' && (
                  <StatusBadge tone="info">{t('menu_authoring_match_alias')}</StatusBadge>
                )}
              </div>
              <div className={styles.candidateActions}>
                <button type="button" disabled={duplicate} onClick={() => onSelect(candidate)}>
                  {t(duplicate ? 'option_set_duplicate_reference' : 'option_set_use_reference')}
                </button>
                {canRecordAlias && (
                  <button type="button" onClick={() => void recordDecision(candidate, 'accept')}>
                    {t('menu_authoring_save_alias')}
                  </button>
                )}
                <button type="button" onClick={() => void recordDecision(candidate, 'reject')}>
                  {t('menu_authoring_reject_match')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {search.nextCursor && (
        <button
          type="button"
          className={styles.more}
          disabled={search.isLoadingMore}
          onClick={() => void search.loadMore()}
        >
          {t(search.isLoadingMore ? 'loading' : 'load_more')}
        </button>
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import type { useProductEditorForm } from '@/hooks/admin/useProductEditorForm';
import {
  OPTION_SET_PAGE_LIMIT,
  type OptionSetDetail,
  type OptionSetKind,
  type OptionSetSummary,
} from '@/types/optionSet';
import { getOptionSet, searchOptionSets } from '@/services/optionSetService';
import { applyOptionSetToEditor, optionSetHasCompleteReferences } from '@/utils/applyOptionSetToEditor';
import { getErrorMessage } from '@/utils/apiClient';
import { OPTION_SET_KIND_LABEL_KEYS } from '@/utils/optionSetLabels';
import { formatCurrency } from '@/utils/currency';
import { optionSetEntryPrice } from '@/utils/optionSetEntryPrice';
import styles from './EditorOptionSetPicker.module.css';
import EditorOptionSetLink from './EditorOptionSetLink';

interface Props {
  readonly editor: ReturnType<typeof useProductEditorForm>;
  readonly isBundle: boolean;
  readonly kinds: readonly OptionSetKind[];
  readonly product?: ProductDetails;
  readonly isDirty?: boolean;
  readonly onApplied?: () => void;
}

/** Relevant reusable sets beside the active section, copied into the unsaved draft on demand. */
export default function EditorOptionSetPicker({ editor, isBundle, kinds, product, isDirty = false, onApplied }: Props) {
  const { t } = useTranslation();
  const [sets, setSets] = useState<OptionSetSummary[]>([]);
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<OptionSetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setPreview(null);
    setLoading(true);
    setError(null);
    Promise.all(
      kinds.map((kind) =>
        searchOptionSets({ kind, query: query.trim(), limit: OPTION_SET_PAGE_LIMIT }, controller.signal),
      ),
    )
      .then((pages) => {
        if (!controller.signal.aborted)
          setSets(pages.flatMap((page) => page.items).filter((set) => set.status === 'active'));
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(getErrorMessage(requestError) ?? 'option_set_load_error');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [kinds, query]);

  const openPreview = async (set: OptionSetSummary) => {
    setApplyingId(set.id);
    setError(null);
    setOutcome(null);
    try {
      const detail = await getOptionSet(set.id);
      setPreview(detail);
    } catch (requestError) {
      setError(getErrorMessage(requestError) ?? 'option_set_load_error');
    } finally {
      setApplyingId(null);
    }
  };

  const apply = () => {
    if (!preview) return;
    setOutcome(
      t(
        applyOptionSetToEditor(preview, editor, isBundle)
          ? 'editor_option_set_applied'
          : 'editor_option_set_nothing_added',
      ),
    );
    setPreview(null);
  };
  const variationUnsupported = Boolean(
    preview &&
    !isBundle &&
    preview.kind === 'bundleChoice' &&
    preview.entries.some((entry) => entry.productVariationId),
  );
  const referencesMissing = Boolean(preview && !optionSetHasCompleteReferences(preview));

  return (
    <section className={styles.card} aria-labelledby="editor-option-sets-heading">
      <h2 id="editor-option-sets-heading">{t('editor_option_sets_title')}</h2>
      <p className={styles.help}>{t('editor_option_sets_help')}</p>
      <label className={styles.searchLabel}>
        {t('option_sets_search')}
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {loading && <output>{t('loading')}</output>}
      {error && (
        <p role="alert" className={styles.error}>
          {error === 'option_set_load_error' ? t(error) : error}
        </p>
      )}
      {outcome && <output className={styles.outcome}>{outcome}</output>}
      {!loading && !error && sets.length === 0 && <p className={styles.empty}>{t('editor_option_sets_empty')}</p>}
      <ul className={styles.list}>
        {sets.map((set) => (
          <li key={set.id}>
            <div>
              <strong dir="auto">{set.name}</strong>
              <small>
                {t(OPTION_SET_KIND_LABEL_KEYS[set.kind])} · {t('option_sets_entries_count', { count: set.entryCount })}
              </small>
            </div>
            <button type="button" disabled={Boolean(applyingId)} onClick={() => void openPreview(set)}>
              {t(applyingId === set.id ? 'loading' : 'editor_option_set_preview')}
            </button>
          </li>
        ))}
      </ul>
      {preview && (
        <div className={styles.preview}>
          <h3 dir="auto">{preview.name}</h3>
          <p>{t('editor_option_set_preview_help')}</p>
          {variationUnsupported && (
            <p role="alert" className={styles.error}>
              {t('editor_option_set_variation_bundle_only')}
            </p>
          )}
          {referencesMissing && (
            <p role="alert" className={styles.error}>
              {t('editor_option_set_references_missing')}
            </p>
          )}
          <ul>
            {preview.entries.map((entry, index) => {
              const price = optionSetEntryPrice(preview.kind, entry);
              return (
                <li key={entry.id ?? `${entry.name}-${index}`}>
                  <span dir="auto">{entry.name}</span>
                  {price > 0 && <span>+{formatCurrency(price)}</span>}
                </li>
              );
            })}
          </ul>
          <div className={styles.previewActions}>
            <button type="button" onClick={apply} disabled={variationUnsupported || referencesMissing}>
              {t('editor_option_set_apply')}
            </button>
            <button type="button" onClick={() => setPreview(null)}>
              {t('cancel')}
            </button>
          </div>
          {product && onApplied && (
            <EditorOptionSetLink
              key={preview.id}
              set={preview}
              product={product}
              isDirty={isDirty}
              onApplied={onApplied}
            />
          )}
        </div>
      )}
      <Link href="/admin/option-sets">{t('editor_option_sets_manage')}</Link>
    </section>
  );
}

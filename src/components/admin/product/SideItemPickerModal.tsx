'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import SideItemPickerRow from './SideItemPickerRow';
import { useSideItemSearch } from '@/hooks/admin/useSideItemSearch';
import type { SideItemDetails } from '@/hooks/admin/useSideItemDetails';
import {
  applySideItemDraft,
  isSelfSuggestion,
  resultsNotAlreadyListed,
  sideItemDraftChanged,
  sideItemLabel,
  toggleSideItem,
} from './sideItemPicker';
import styles from './SideItemPickerModal.module.css';

interface SideItemPickerModalProps {
  /** What the product suggests today, in the order the server sent it. */
  selectedSideItemIds: string[];
  /** Names for those ids. Fetched once by the section, never a second time here. */
  selectedItemsDetails: ReadonlyMap<string, SideItemDetails>;
  /** The whole set the product should suggest — a REPLACEMENT, never a merge. */
  onApply: (ids: string[]) => void;
  onClose: () => void;
  /** The product being edited, when it has one. It may never suggest itself. */
  productId?: string;
}

/**
 * Pick the side items suggested with a dish — `BaseModal`, add **and** remove
 * (MENU-ITEM-EDITOR-REDESIGN-PLAN **D12**, slice S9).
 *
 * What it replaces: an inline `<details>`-style expander wired to a merge, so a tick added and an
 * untick did nothing. Removal existed only as an `×` on the chip outside it, which is a different
 * control in a different place for the other half of one decision.
 *
 * **Mounted only while open**, which is why there is no `isOpen` prop and no reseeding effect: the
 * draft is seeded by `useState` at mount, so it cannot go stale against the form, a Cancel throws
 * the whole thing away by unmounting, and the search hook's in-flight debounce dies with it.
 *
 * Two groups, and the split is load-bearing. `listedIds` is a SNAPSHOT of what the product
 * suggested when the picker opened — not the live draft — so unticking a row leaves it on screen to
 * be re-ticked. Search results then exclude those ids, because one item drawn as two rows would
 * read as two items.
 */
export default function SideItemPickerModal({
  selectedSideItemIds,
  selectedItemsDetails,
  onApply,
  onClose,
  productId,
}: Readonly<SideItemPickerModalProps>) {
  const { t } = useTranslation();
  const { search, setSearch, results, status, searchError } = useSideItemSearch();
  const [draft, setDraft] = useState<string[]>(selectedSideItemIds);
  const [listedIds] = useState<string[]>(selectedSideItemIds);

  const toggle = (id: string, checked: boolean) => setDraft((previous) => toggleSideItem(previous, id, checked));

  const apply = () => {
    onApply(applySideItemDraft(draft, productId));
    onClose();
  };

  const renderRow = (id: string, name: string, description?: string) => (
    <SideItemPickerRow
      key={id}
      id={id}
      name={name}
      description={description}
      checked={draft.includes(id)}
      alreadyAdded={listedIds.includes(id)}
      isSelf={isSelfSuggestion(id, productId)}
      onToggle={(checked) => toggle(id, checked)}
    />
  );

  const footer = (
    <div className={styles.footer}>
      <button type="button" className={styles.cancelButton} onClick={onClose}>
        {t('cancel')}
      </button>
      <button
        type="button"
        className={styles.confirmButton}
        onClick={apply}
        disabled={!sideItemDraftChanged(selectedSideItemIds, draft, productId)}
      >
        {t('apply')}
      </button>
    </div>
  );

  return (
    <BaseModal isOpen onClose={onClose} title={t('suggested_side_items')} size="lg" footer={footer}>
      {/* The one sentence that says what a tick means in BOTH directions, and that this dialog does
          not reach the server — the editor has exactly ONE Save (D4) and it is the page's. */}
      <p className={styles.hint}>{t('side_items_picker_hint')}</p>

      <div className={styles.searchRow}>
        <label className={styles.searchLabel} htmlFor="side-item-search">
          {t('search_side_items')}
        </label>
        {/* Type-ahead: the hook debounces and searches on its own, so there is nothing left for an
            Enter key or a Search button to trigger. */}
        <input
          id="side-item-search"
          type="search"
          className={styles.searchInput}
          placeholder={t('search_placeholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <h3 className={styles.groupHeading}>{t('side_items_picker_current')}</h3>
      {listedIds.length === 0 ? (
        <p className={styles.notice}>{t('no_side_items_selected')}</p>
      ) : (
        <ul className={styles.list}>
          {listedIds.map((id) => renderRow(id, sideItemLabel(id, selectedItemsDetails, results)))}
        </ul>
      )}

      {/* The heading appears only once a search has been RUN. Before that the list below it is
          empty by definition, and a permanent `Matching items` over nothing promises a match that
          was never looked for — the same "no rows is five different situations" rule the statuses
          below are built on (`useSideItemSearch`). */}
      {status !== 'idle' && status !== 'tooShort' && (
        <h3 className={styles.groupHeading}>{t('side_items_picker_found')}</h3>
      )}
      {/* `<output>`, not `<p role="status">` — it carries the status role implicitly, which is what
          tells a screen reader an answer is still coming (Sonar S6819, the convention this repo
          settled on). */}
      {status === 'searching' && <output className={styles.notice}>{t('searching')}</output>}

      {/* `searchError` first, and it SUPPRESSES the empty state rather than sitting beside it: "No
          side items found" is an answer about the menu, and a failed search has not obtained one.
          The empty state renders from `status`, never from `results.length`: under type-ahead the
          latter would say "none found" after the first keystroke of every word anyone types, and
          again while every request is in flight. */}
      {searchError ? (
        <p className={styles.error} role="alert">
          {searchError}
        </p>
      ) : (
        status === 'empty' && <p className={styles.notice}>{t('no_side_items_found')}</p>
      )}

      {status === 'results' && (
        <ul className={styles.list}>
          {resultsNotAlreadyListed(results, listedIds).map((result) =>
            renderRow(result.id, result.name, result.description),
          )}
        </ul>
      )}
    </BaseModal>
  );
}

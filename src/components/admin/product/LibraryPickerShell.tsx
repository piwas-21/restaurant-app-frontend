'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import LibraryApplyModal, { type LibraryApplyEndpoints } from './LibraryApplyModal';
import LibraryArchivedList from './LibraryArchivedList';
import LibraryPickerFooter from './LibraryPickerFooter';
import LibraryPickerResults from './LibraryPickerResults';
import LibraryPickerRow from './LibraryPickerRow';
import LibraryPickerToolbar, { type LibraryPickerView } from './LibraryPickerToolbar';
import type { LibraryPickerCopy } from './libraryPickerCopy';
import { getErrorMessage } from '@/utils/apiClient';
import { serverMessage } from '@/utils/apiFormErrors';
import type { CatalogRow, LibraryCatalog } from '@/hooks/admin/useLibraryCatalog';
import type { LibraryArchive, LibraryResponse } from '@/hooks/admin/useLibraryArchive';
import styles from './GlobalIngredientPickerModal.module.css';

interface LibraryPickerShellProps<TRow extends CatalogRow> {
  isOpen: boolean;
  onClose: () => void;
  /** Which catalog's words to render — the whole of what makes this an ingredient or a variation picker. */
  copy: LibraryPickerCopy;
  /** The browsable half, and the archived half. The caller owns both hooks because it owns the endpoints. */
  library: LibraryCatalog<TRow>;
  archive: LibraryArchive<TRow>;
  /**
   * Which half is on screen. Held by the caller, not here, because its archive hook fetches only
   * when the drawer is actually open and so has to be told.
   */
  view: LibraryPickerView;
  onViewChange: (view: LibraryPickerView) => void;
  /** `POST /api/<catalog>` for the name the search did not find. */
  createRow: (defaultName: string) => Promise<LibraryResponse<TRow> | undefined>;
  /** Receives the picked catalog rows. The caller maps them onto the product. */
  onAdd: (rows: TRow[]) => void;
  /**
   * The catalog-wide attach (plan S8), supplied by the two modals because it is their endpoints.
   *
   * Optional: a picker without it is exactly the picker that shipped in S2/S4, and the row draws no
   * "Apply to items" action at all.
   */
  apply?: LibraryApplyEndpoints;
}

/**
 * A library picker: browse a global catalog, tick rows, attach them — and keep the catalog tidy.
 *
 * One shell for both catalogs (plan S2/S3 for ingredients, S4 for variations). Everything here is
 * about SELECTION and the two writes that a picker owns; what a catalog IS — its endpoints, its
 * words, and what attaching a row means to a product — arrives as props, so the two modals above it
 * are a hook pair and a mapping each.
 *
 * Retiring is soft in every case (plan D4) and reversible from the Archived view, so nothing an
 * admin does here can reach the copies already sitting on products, let alone on past orders.
 */
export default function LibraryPickerShell<TRow extends CatalogRow>({
  isOpen,
  onClose,
  copy,
  library,
  archive,
  view,
  onViewChange,
  createRow,
  onAdd,
  apply,
}: Readonly<LibraryPickerShellProps<TRow>>) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<TRow[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  /**
   * The row whose catalog-wide attach is on screen (plan S8).
   *
   * It replaces this modal's BODY rather than opening a second one. The picker is already a
   * `BaseModal`; a dialog over a dialog traps focus twice and leaves the admin with two Escape keys
   * that mean different things, for what is one task in two steps.
   */
  const [applying, setApplying] = useState<TRow | null>(null);

  const close = () => {
    setSelected([]);
    setCreateError(null);
    setApplying(null);
    onViewChange('active');
    library.reset();
    onClose();
  };

  const toggle = (row: TRow, checked: boolean) => {
    setSelected((previous) =>
      checked
        ? [...previous.filter((entry) => entry.id !== row.id), row]
        : previous.filter((entry) => entry.id !== row.id),
    );
  };

  const add = (rows: TRow[]) => {
    onAdd(rows);
    close();
  };

  const newName = library.query.trim();

  /**
   * Create the row the search did not find, then attach it with everything already ticked. The
   * caller sends no translations: a name typed into a search box has none yet, and both backends
   * build their translation list from whatever arrives.
   */
  const createAndAdd = async () => {
    if (newName.length === 0 || isCreating) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const response = await createRow(newName);
      if (!response?.success || !response.data?.id) {
        setCreateError(serverMessage(response) ?? t(copy.createFailed));
        return;
      }
      add([...selected, response.data]);
    } catch (error) {
      setCreateError(getErrorMessage(error) ?? t(copy.createFailed));
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Retire a row, then take it out of the list on screen — in that order. Marking it first would
   * hide a row that is still there whenever the write fails.
   */
  const retire = async (row: TRow) => {
    const done = await archive.archive(row.id);
    if (!done) return;
    library.markArchived(row.id);
    setSelected((previous) => previous.filter((entry) => entry.id !== row.id));
  };

  const footer = (
    <LibraryPickerFooter
      copy={copy}
      view={view}
      newName={newName}
      isCreating={isCreating}
      onCreate={() => void createAndAdd()}
      onCancel={close}
      selectedCount={selected.length}
      onAdd={() => add(selected)}
    />
  );

  // The apply step owns the whole dialog while it is on screen — its own title, its own body and
  // its own footer — so nothing behind it can be ticked while a catalog-wide write is being decided.
  // The apply step OWNS the dialog while it is on screen, replacing this one rather than stacking
  // over it: two BaseModals means focus trapped twice and two Escape keys with different meanings.
  if (applying && apply) {
    return (
      <LibraryApplyModal
        isOpen={isOpen}
        row={applying}
        copy={copy}
        endpoints={apply}
        onBack={() => setApplying(null)}
        onClose={close}
        onAttached={library.reload}
      />
    );
  }

  return (
    <BaseModal isOpen={isOpen} onClose={close} title={t(copy.title)} size="lg" footer={footer}>
      <LibraryPickerToolbar
        copy={copy}
        view={view}
        onViewChange={onViewChange}
        query={library.query}
        onQueryChange={library.setQuery}
        filter={library.filter}
        onFilterChange={library.setFilter}
      />

      {(createError ?? archive.actionError) && (
        <p className={styles.error} role="alert">
          {createError ?? archive.actionError}
        </p>
      )}

      {view === 'active' ? (
        <LibraryPickerResults
          status={library.status}
          loadError={library.loadError}
          onRetry={library.reload}
          isEmpty={library.matchCount === 0}
          emptyKey={copy.empty}
          retryKey={copy.retry}
          hiddenNote={
            library.matchCount > library.visible.length ? (
              <p className={styles.notice}>
                {t(copy.showing, { shown: library.visible.length, total: library.matchCount })}
              </p>
            ) : null
          }
        >
          {library.visible.map((row) => (
            <LibraryPickerRow
              key={row.id}
              row={row}
              copy={copy}
              checked={selected.some((entry) => entry.id === row.id)}
              alreadyAdded={library.isAttached(row)}
              onToggle={(checked) => toggle(row, checked)}
              onArchive={() => void retire(row)}
              isPending={archive.pendingId === row.id}
              onApplyToItems={apply ? () => setApplying(row) : undefined}
            />
          ))}
        </LibraryPickerResults>
      ) : (
        <LibraryArchivedList archive={archive} copy={copy} />
      )}
    </BaseModal>
  );
}

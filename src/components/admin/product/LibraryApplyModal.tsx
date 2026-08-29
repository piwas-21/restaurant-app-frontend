'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import LibraryApplyFooter from './LibraryApplyFooter';
import LibraryApplyToItemsPanel from './LibraryApplyToItemsPanel';
import type { LibraryPickerCopy } from './libraryPickerCopy';
import { useLibraryApplyToItems } from '@/hooks/admin/useLibraryApplyToItems';
import type { AttachResult, CatalogUsageProduct } from '@/services/libraryAttachService';

/** The backend envelope, as the two apply endpoints return it. */
export interface ApplyEnvelope<T> {
  data?: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

/** The two calls that make this the INGREDIENT or the VARIATION apply step. */
export interface LibraryApplyEndpoints {
  /** `GET /api/global-…/{id}/products` — which products already carry the row. */
  fetchUsage: (id: string) => Promise<ApplyEnvelope<CatalogUsageProduct[]> | undefined>;
  /** `POST /api/global-…/{id}/attach` — the catalog-wide write, given the ids the plan resolved. */
  attach: (id: string, productIds: string[]) => Promise<ApplyEnvelope<AttachResult> | undefined>;
}

interface LibraryApplyModalProps {
  isOpen: boolean;
  /** The library row being applied. Its name is the subject of every sentence on the screen. */
  row: { id: string; defaultName: string };
  copy: LibraryPickerCopy;
  endpoints: LibraryApplyEndpoints;
  /** Back to the picker, keeping the dialog open. */
  onBack: () => void;
  /** Close the whole picker. */
  onClose: () => void;
  /** Reload the catalog, so the row's "used on N items" reflects what just happened. */
  onAttached: () => void;
}

/**
 * The apply step of a library picker, as its own dialog state (plan S8, decision D6).
 *
 * **It REPLACES the picker rather than opening over it.** A dialog over a dialog traps focus twice
 * and leaves the admin with two Escape keys that mean different things, for what is one task in two
 * steps. The shell renders this instead of itself, so there is only ever one `BaseModal` mounted.
 *
 * A separate component rather than a branch inside the shell, for a reason worth keeping: the shell
 * was over its 250-line cap with the branch inline, and the branch needs a HOOK whose state the body
 * and the footer both read. Extracting it puts that hook where it can be called unconditionally by a
 * component that only exists while the step is on screen — which is simpler than the shell's
 * alternative of calling it always and passing a null row.
 */
export default function LibraryApplyModal({
  isOpen,
  row,
  copy,
  endpoints,
  onBack,
  onClose,
  onAttached,
}: Readonly<LibraryApplyModalProps>) {
  const { t } = useTranslation();
  const apply = useLibraryApplyToItems({
    rowId: row.id,
    fetchUsage: endpoints.fetchUsage,
    attach: endpoints.attach,
    uncategorisedName: t(copy.applyUncategorised),
    messages: { loadFailed: copy.applyLoadFailed, attachFailed: copy.applyFailed },
    onAttached,
  });

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t(copy.applyTitle)}
      size="lg"
      footer={
        // The confirm keeps the modal's own FOOTER slot: it is the button that states the blast
        // radius, and burying it under a scrolling list of forty products is where a catalog-wide
        // action stops being reviewed before it is taken.
        <LibraryApplyFooter
          copy={copy}
          plan={apply.plan}
          isSaving={apply.isSaving}
          isDone={apply.result !== null}
          onBack={onBack}
          onConfirm={() => void apply.save()}
        />
      }
    >
      <LibraryApplyToItemsPanel
        rowName={row.defaultName}
        copy={copy}
        status={apply.status}
        error={apply.error}
        errorKey={apply.errorKey}
        groups={apply.groups}
        products={apply.products}
        selectedIds={apply.selectedIds}
        onSelectionChange={apply.setSelectedIds}
        alreadyAttachedIds={apply.alreadyAttachedIds}
        result={apply.result}
      />
    </BaseModal>
  );
}

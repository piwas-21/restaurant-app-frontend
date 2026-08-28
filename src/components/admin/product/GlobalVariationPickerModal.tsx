'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import LibraryPickerShell from './LibraryPickerShell';
import { type LibraryPickerView } from './LibraryPickerToolbar';
import { VARIATION_LIBRARY_COPY } from './libraryPickerCopy';
import { useGlobalVariationLibrary } from '@/hooks/admin/useGlobalVariationLibrary';
import { useGlobalVariationArchive } from '@/hooks/admin/useGlobalVariationArchive';
import { createGlobalVariation } from '@/services/globalVariationService';
import { toProductVariation } from './globalVariationLibrary';
import type { Variation } from './types';

interface GlobalVariationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The product's current variations — what "already added" is measured against. */
  attached: Pick<Variation, 'name' | 'globalVariationId'>[];
  /**
   * The `displayOrder` the first appended row takes. One PAST the highest in use, not the row
   * count: `useVariationReorder` (#593) documents that live `displayOrder` data holds gaps and
   * duplicates, so counting rows would land a picked row on top of an existing one.
   */
  nextDisplayOrder: number;
  /**
   * Receives the picked rows, already mapped to product variations. The caller APPENDS each one to
   * its react-hook-form field array — this modal never touches the form itself.
   */
  onAdd: (variations: Variation[]) => void;
}

/**
 * Browse the global variation library and attach rows to the product (plan S4).
 *
 * The catalog is 50 seeded rows in nine languages (backend #431) and, until this modal, no screen
 * listed it — variations had to be typed by hand on every product, translations and all. Picking a
 * row copies its name and its nine translations onto the product and records `globalVariationId`
 * as provenance. Copy semantics (plan D3): what is attached is the product's own from that moment,
 * and a later edit of the library row does NOT propagate.
 *
 * **What it does NOT copy is the price, because the catalog does not have one.** A variation's
 * money is its `PriceModifier`, and that is more product-specific than an ingredient's price ever
 * was — "Large" is +2.00 on a pizza and +0.50 on a coffee. Every picked row therefore lands at a
 * modifier of 0, which is neutral rather than wrong, and the admin types the one fact the library
 * could never have known.
 *
 * The picker itself is `LibraryPickerShell`, shared with the ingredient library. What is left here
 * is what makes it the VARIATION picker: two hooks over two endpoints, and the mapping onto a
 * product row.
 *
 * **How it differs from the ingredient picker, and why.** That one calls `changeIngredients` with a
 * whole new array, because `ProductIngredientsManager` owns its rows as component state. Variations
 * are a react-hook-form field array, so this modal hands the mapped rows back and the caller
 * APPENDS them one at a time — replacing the array would discard react-hook-form's per-row `field.id`
 * and every registration bound to an index, which is not a re-render but a remount of the whole
 * table.
 */
export default function GlobalVariationPickerModal({
  isOpen,
  onClose,
  attached,
  nextDisplayOrder,
  onAdd,
}: Readonly<GlobalVariationPickerModalProps>) {
  const { i18n } = useTranslation();
  const [view, setView] = useState<LibraryPickerView>('active');
  const library = useGlobalVariationLibrary({ isOpen, attached, languageCode: i18n.language });
  const archive = useGlobalVariationArchive({
    isOpen,
    isViewingArchive: view === 'archived',
    onCatalogChanged: library.reload,
  });

  return (
    <LibraryPickerShell
      isOpen={isOpen}
      onClose={onClose}
      copy={VARIATION_LIBRARY_COPY}
      library={library}
      archive={archive}
      view={view}
      onViewChange={setView}
      createRow={(defaultName) => createGlobalVariation({ defaultName, translations: [] })}
      onAdd={(picked) => onAdd(picked.map((row, index) => toProductVariation(row, nextDisplayOrder + index)))}
    />
  );
}

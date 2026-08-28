'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Library } from 'lucide-react';
import type { FieldValues, UseFormGetValues } from 'react-hook-form';
import GlobalVariationPickerModal from './GlobalVariationPickerModal';
import { readVariationRows } from './globalVariationLibrary';
import type { Variation } from './types';
import groupStyles from './IngredientGroup.module.css';

interface VariationLibraryButtonProps {
  /** Read the form STORE — see `readVariationRows` for why this and not `useFieldArray`'s `fields`. */
  getValues: UseFormGetValues<FieldValues>;
  /** Append one picked row to the variations field array. */
  appendVariation: (variation: Variation) => void;
}

/**
 * "Add from library" and the picker behind it (plan S4).
 *
 * Its own component so `ProductVariations` keeps one job. That table already grew a second one in
 * #593 (reordering), and the file-length gate is what noticed: the button, the open state, the
 * store read and the modal are a self-contained feature that the table merely hosts.
 *
 * The picked rows are APPENDED one at a time, never handed over as a replacement array — replacing
 * a react-hook-form field array discards every per-row `field.id` and every index-bound
 * registration, which is a remount of the table rather than a re-render. The ingredient picker
 * hands over a whole new list only because its rows are component state, not a field array.
 */
export default function VariationLibraryButton({ getValues, appendVariation }: Readonly<VariationLibraryButtonProps>) {
  const { t } = useTranslation();
  // The picker's view of the product, captured from the store on open. The snapshot IS the open flag.
  const [picker, setPicker] = useState<ReturnType<typeof readVariationRows> | null>(null);

  return (
    <>
      <button
        type="button"
        className={groupStyles.addButton}
        onClick={() => setPicker(readVariationRows(getValues('variations')))}
      >
        <Library size={16} aria-hidden="true" />
        {t('variation_library_open')}
      </button>

      <GlobalVariationPickerModal
        isOpen={picker !== null}
        onClose={() => setPicker(null)}
        attached={picker?.attached ?? []}
        nextDisplayOrder={picker?.nextDisplayOrder ?? 0}
        onAdd={(picked: Variation[]) => picked.forEach(appendVariation)}
      />
    </>
  );
}

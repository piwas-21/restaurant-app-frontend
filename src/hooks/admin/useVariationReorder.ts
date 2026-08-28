import { useCallback } from 'react';
import type { FieldValues, UseFormGetValues, UseFormSetValue } from 'react-hook-form';

interface VariationReorder {
  getValues: UseFormGetValues<FieldValues>;
  setValue: UseFormSetValue<FieldValues>;
  /**
   * The variations field array — structurally, because only `move` is used. Naming the method
   * rather than importing `UseFieldArrayReturn` keeps this file free of the `any` generic that
   * type would otherwise drag in, and states exactly what the hook depends on.
   */
  variations: { move: (from: number, to: number) => void };
}

/**
 * Move a variation row and RENUMBER every `displayOrder` — frontend **#593**, editor slice **S8**.
 *
 * ### Why `useFieldArray.move` is necessary and not sufficient
 *
 * `move` reorders the field array's own value objects, so each row's `displayOrder` travels WITH
 * its row: move a `displayOrder: 2` above a `displayOrder: 1` and the screen shows the new order
 * while the payload still says the old one. `displayOrder` is what every consumer sorts by, so
 * that save would silently undo the move on the next load. That is the entire reason this is a
 * hook and not a call to `move` in the component.
 *
 * It also cannot be repaired at submit time. `displayOrder` has no input anywhere on the page — the
 * screens do not draw one — so the only record of the admin's intent is the array order at the
 * moment of the move, and normalising here keeps the store and the screen saying one thing.
 *
 * ### Why it renumbers instead of swapping two values
 *
 * Nothing wrote this column after row creation until now, so live data can hold gaps and
 * duplicates. Re-stamping 0..n-1 across the whole array repairs that on any move; swapping two
 * values would faithfully preserve the damage.
 *
 * `shouldDirty` is what enables Save — a reorder IS a change, and while `move` marks the array
 * dirty, a `setValue` that skipped the flag could leave the form looking clean.
 */
export function useVariationReorder({ getValues, setValue, variations }: VariationReorder) {
  return useCallback(
    (index: number, delta: -1 | 1) => {
      const rows = (getValues('variations') as unknown[] | undefined) ?? [];
      const target = index + delta;
      // Guarded, not asserted: a disabled end-of-list button that is somehow activated must be a
      // no-op rather than a reorder that renumbers and dirties the form for nothing.
      if (index < 0 || index >= rows.length || target < 0 || target >= rows.length) return;

      variations.move(index, target);
      rows.forEach((_, position) => setValue(`variations.${position}.displayOrder`, position, { shouldDirty: true }));
    },
    [getValues, setValue, variations],
  );
}

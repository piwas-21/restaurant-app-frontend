import { useCallback, useMemo, useRef, useState } from 'react';
import {
  applyIngredientTranslations,
  fetchAllIngredientCarriers,
  type IngredientApplyReceipt,
  type IngredientTranslationInput,
} from '@/services/ingredientTranslationService';
import { createGlobalIngredient, type GlobalIngredientTranslation } from '@/services/globalIngredientService';
import {
  buildIngredientEntries,
  translationsForSave,
  type IngredientCarrierProduct,
  type IngredientEntry,
  type LocaleCell,
} from '@/utils/ingredientTranslationEntries';
import type { IngredientKind } from '@/types/menu';

/** Edits held for one entry, by locale — absent means "leave what the copies say". */
export type EntryEdits = Record<string, string>;

/**
 * Optimistic commit for one entry's locale cells after a successful bulk-apply: every locale the
 * save wrote collapses to consensus (the saved name, nothing to disagree about, nothing missing);
 * locales the admin left BLANK keep their reading. Module-level so the setState mapper in `save`
 * stays shallow (S2004) — this is the fold, and it is pure.
 */
function collapseSavedCells(
  saved: readonly IngredientTranslationInput[],
  cells: Readonly<Record<string, LocaleCell>>,
): Record<string, LocaleCell> {
  return Object.fromEntries(
    Object.entries(cells).map(([locale, cell]): [string, LocaleCell] => {
      const written = saved.find((translation) => translation.languageCode === locale);
      return written ? [locale, { value: written.name, disagreements: 0, missing: 0 }] : [locale, cell];
    }),
  );
}

/**
 * Page logic behind the Ingredients & Sauces translations manager (partner feedback, mcdoner:
 * fixing an ingredient on one product never reached the other products' copies).
 *
 * The flow: walk the whole catalog once, fold every product's ingredient copies into entries
 * (`buildIngredientEntries`), let the admin edit per-locale names in place, and save through the
 * bulk-apply endpoint so the fix lands on EVERY product and bundle option that references the
 * ingredient — the one write the per-product editor structurally cannot do.
 *
 * An entry whose copies carry no library provenance is saved by FIRST creating its library row
 * (the same promotion the product editor's reconciliation performs on every save) and applying
 * through that id — so a legacy name-only ingredient ends up properly linked instead of being
 * refused with "no library row".
 */
export function useIngredientTranslations() {
  const [entries, setEntries] = useState<IngredientEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The catalog walk is many paged requests; a Retry pressed mid-walk (or an unmount) must
  // make the stale walk a no-op rather than let its late resolution clobber the newer state.
  const loadEpoch = useRef(0);
  const [edits, setEdits] = useState<Record<string, EntryEdits>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<IngredientApplyReceipt | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const epoch = ++loadEpoch.current;
    setLoading(true);
    setLoadError(null);
    setReceipt(null);
    setSaveError(null);
    try {
      const carriers: IngredientCarrierProduct[] = await fetchAllIngredientCarriers();
      if (epoch !== loadEpoch.current) return;
      setEntries(buildIngredientEntries(carriers));
    } catch (error) {
      if (epoch !== loadEpoch.current) return;
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      if (epoch === loadEpoch.current) setLoading(false);
    }
  }, []);

  const edit = useCallback((entryKey: string, locale: string, name: string) => {
    setEdits((previous) => ({
      ...previous,
      [entryKey]: { ...previous[entryKey], [locale]: name.trim() },
    }));
  }, []);

  const clearEdits = useCallback((entryKey: string) => {
    setEdits((previous) => {
      if (!previous[entryKey]) return previous;
      const { [entryKey]: _removed, ...rest } = previous;
      return rest;
    });
  }, []);

  const save = useCallback(
    async (entry: IngredientEntry) => {
      setSavingKey(entry.key);
      setReceipt(null);
      setSaveError(null);
      try {
        const entryEdits = edits[entry.key] ?? {};
        const translations: IngredientTranslationInput[] = translationsForSave(entry, entryEdits);
        let libraryId = entry.globalIngredientId;

        if (!libraryId) {
          // Name-only copies (typed before provenance existed): promote to a library row first,
          // exactly as the product editor's reconciliation would on the next product save.
          const kind: IngredientKind = entry.isSauce ? 'sauce' : 'ingredient';
          const payload: GlobalIngredientTranslation[] = translations.map(({ languageCode, name }) => ({
            languageCode,
            name,
          }));
          const created = await createGlobalIngredient({ defaultName: entry.defaultName, translations: payload, kind });
          if (!created?.success || !created.data?.id) {
            setSaveError(created?.message ?? 'ingredient_translations_save_failed');
            return;
          }
          libraryId = created.data.id;
        }

        const applied = await applyIngredientTranslations(libraryId, translations);
        if (!applied?.success || !applied.data) {
          setSaveError(applied?.message ?? 'ingredient_translations_save_failed');
          return;
        }

        // Optimistic local commit: every copy now carries the saved names, so the cells collapse
        // to consensus. The values the admin left BLANK are untouched on the server and in state.
        setEntries((previous) =>
          previous.map((candidate) =>
            candidate.key === entry.key
              ? {
                  ...candidate,
                  globalIngredientId: libraryId,
                  copies: candidate.copies,
                  cells: collapseSavedCells(translations, candidate.cells),
                }
              : candidate,
          ),
        );
        setReceipt(applied.data);
        setEdits((previous) => {
          const { [entry.key]: _done, ...rest } = previous;
          return rest;
        });
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : String(error));
      } finally {
        setSavingKey(null);
      }
    },
    [edits],
  );

  const isDirty = useMemo(
    () =>
      new Set(
        Object.entries(edits)
          .filter(([, locales]) => Object.values(locales).some((name) => name.length > 0))
          .map(([key]) => key),
      ),
    [edits],
  );

  return { entries, loading, loadError, load, edits, edit, clearEdits, save, savingKey, receipt, saveError, isDirty };
}

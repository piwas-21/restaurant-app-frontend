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
 * locales the admin left BLANK keep their reading. Module-level so the setState mapper in `saveAll`
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
 * One entry's bulk-apply: promote a name-only entry to a library row first (the same promotion
 * the product editor's reconciliation performs on every save), then apply through that id.
 * Throws on any refusal so the batch loop can keep the entry's edits and move on.
 */
async function applyOneEntry(
  entry: IngredientEntry,
  entryEdits: EntryEdits,
): Promise<{ libraryId: string; translations: IngredientTranslationInput[]; receipt: IngredientApplyReceipt }> {
  const translations = translationsForSave(entry, entryEdits);
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
      throw new Error(created?.message ?? 'ingredient_translations_save_failed');
    }
    libraryId = created.data.id;
  }

  const applied = await applyIngredientTranslations(libraryId, translations);
  if (!applied?.success || !applied.data) {
    throw new Error(applied?.message ?? 'ingredient_translations_save_failed');
  }
  return { libraryId, translations, receipt: applied.data };
}

/**
 * Page logic behind the Ingredients & Sauces translations manager (partner feedback, mcdoner:
 * fixing an ingredient on one product never reached the other products' copies).
 *
 * The flow: walk the whole catalog once, fold every product's ingredient copies into entries
 * (`buildIngredientEntries`), let the admin edit per-locale names in place, and SAVE IN BATCH —
 * one press applies EVERY dirty entry through the bulk-apply endpoint, entry by entry, so the
 * fix lands on every product and bundle option that references each ingredient.
 *
 * Dirty is judged per FIELD against the entry's current consensus values: an entry is dirty only
 * when some locale edit is non-blank AND differs from what the copies show. A row the admin
 * merely clicked through, or typed back to its original value, is never dirty — blank still
 * means "leave what the copies say".
 *
 * A mid-batch failure keeps the failed entry's edits (still dirty, retryable) and saves the
 * rest; the receipt aggregates what DID land.
 */
export function useIngredientTranslations() {
  const [entries, setEntries] = useState<IngredientEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The catalog walk is many paged requests; a Retry pressed mid-walk (or an unmount) must
  // make the stale walk a no-op rather than let its late resolution clobber the newer state.
  const loadEpoch = useRef(0);
  const [edits, setEdits] = useState<Record<string, EntryEdits>>({});
  const [saving, setSaving] = useState(false);
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

  const isDirty = useMemo(() => {
    const byKey = new Map(entries.map((entry) => [entry.key, entry]));
    const dirty = new Set<string>();
    Object.entries(edits).forEach(([key, locales]) => {
      const entry = byKey.get(key);
      if (!entry) return;
      const changed = Object.entries(locales).some(
        ([locale, name]) => name.length > 0 && name !== entry.cells[locale]?.value,
      );
      if (changed) dirty.add(key);
    });
    return dirty;
  }, [edits, entries]);

  const saveAll = useCallback(async () => {
    if (saving) return;
    // Snapshot the batch: the edits and entries this press commits, whatever re-renders do later.
    const targets = entries.filter((entry) => isDirty.has(entry.key));
    if (targets.length === 0) return;

    setSaving(true);
    setReceipt(null);
    setSaveError(null);

    const savedTranslations = new Map<string, IngredientTranslationInput[]>();
    const savedLibraryIds = new Map<string, string>();
    const savedReceiptItems: IngredientApplyReceipt['items'] = [];
    const failures: string[] = [];
    let savedProductCount = 0;
    let savedIngredientCount = 0;

    for (const entry of targets) {
      try {
        const { libraryId, translations, receipt: applied } = await applyOneEntry(entry, edits[entry.key] ?? {});
        savedTranslations.set(entry.key, translations);
        savedLibraryIds.set(entry.key, libraryId);
        savedReceiptItems.push(...applied.items);
        savedProductCount += applied.updatedProductCount;
        savedIngredientCount += applied.updatedIngredientCount;
      } catch (error) {
        // The server's reason reaches the page's banner through saveError; the row stays dirty.
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }

    if (savedTranslations.size > 0) {
      // Optimistic local commit: every copy of every saved entry now carries the saved names, so
      // those cells collapse to consensus. Failed entries keep their edits — still dirty.
      setEntries((previous) =>
        previous.map((candidate) => {
          const translations = savedTranslations.get(candidate.key);
          if (!translations) return candidate;
          return {
            ...candidate,
            globalIngredientId: savedLibraryIds.get(candidate.key) ?? candidate.globalIngredientId,
            cells: collapseSavedCells(translations, candidate.cells),
          };
        }),
      );
      setEdits((previous) =>
        Object.fromEntries(Object.entries(previous).filter(([key]) => !savedTranslations.has(key))),
      );
      setReceipt({
        updatedProductCount: savedProductCount,
        updatedIngredientCount: savedIngredientCount,
        items: savedReceiptItems,
      });
    }
    if (failures.length > 0) setSaveError(failures[0] || 'ingredient_translations_save_failed');
    setSaving(false);
  }, [edits, entries, isDirty, saving]);

  return { entries, loading, loadError, load, edits, edit, saveAll, saving, receipt, saveError, isDirty };
}

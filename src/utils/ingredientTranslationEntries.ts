import { fold } from '@/utils/nameFold';
import { resolveIngredientKind } from '@/utils/ingredientKind';
import { LANGUAGE_CODES } from '@/config/languageConfig';
import type { ProductIngredient } from '@/types/menu';

/**
 * The model behind the Ingredients & Sauces translations manager (partner feedback, mcdoner:
 * "I fixed one product's ingredient and the other products kept the old name").
 *
 * Ingredients live as PER-PRODUCT COPIES (library plan D3 — attach is COPY, provenance only), so
 * one logical ingredient is N rows with N content maps that drift the moment an admin edits one
 * product and not the others. This module folds those copies back into one editable entry:
 *
 *  - The group key is `globalIngredientId` where a copy carries it (the picker and the save-time
 *    reconciliation stamp it) and the DIACRITIC-FOLDED name otherwise — the same two keys
 *    `attachedLibraryKeys` matches with, so a page row and a product's own "already attached"
 *    check can never disagree about what the same ingredient is.
 *  - Each locale cell reports CONSENSUS (one name) vs CONFLICT (copies disagree) vs MISSING, so
 *    the exact mcdoner case — Chicken Burger's sauce has no fr, its siblings do — is visible at
 *    a glance instead of product-hunting.
 *
 * Pure and React-free: the grouping is what a reviewer will doubt, so it is unit-testable
 * without a DOM. Saving is NOT here — the hook turns an entry into one bulk-apply call.
 */

/** One product's copy of the ingredient, as the manager reads it. */
export interface IngredientCopyUsage {
  readonly productId: string;
  readonly productName: string;
  readonly ingredientId: string;
}

/** One locale's state across every copy of one ingredient. */
export interface LocaleCell {
  /** The name shown in the input — the first non-blank copy reading, so it is never invented. */
  readonly value: string;
  /** Copies whose non-blank name differs from `value`. 0 means every copy agrees. */
  readonly disagreements: number;
  /** Copies carrying no name in this locale. */
  readonly missing: number;
}

/** One editable row of the manager: every copy of one logical ingredient, folded together. */
export interface IngredientEntry {
  /** `id:<globalIngredientId>` or `name:<folded>` — stable within one page load. */
  readonly key: string;
  /** Present when at least one copy carries library provenance; the bulk-apply address. */
  readonly globalIngredientId?: string;
  /** The first copy's language-less name — what the admin typed when authoring the row. */
  readonly defaultName: string;
  readonly isSauce: boolean;
  readonly copies: readonly IngredientCopyUsage[];
  readonly cells: Readonly<Record<string, LocaleCell>>;
}

/** The narrow product shape the manager needs — satisfied by the admin catalog's `Product`. */
export interface IngredientCarrierProduct {
  readonly id: string;
  readonly name?: string | null;
  readonly detailedIngredients?: readonly ProductIngredient[] | null;
}

const blankNames = (): Record<string, string> => Object.fromEntries(LANGUAGE_CODES.map((code) => [code, '']));

const copyNames = (ingredient: ProductIngredient): Record<string, string> => {
  const names = blankNames();
  LANGUAGE_CODES.forEach((code) => {
    names[code] = ingredient.content?.[code]?.name?.trim() ?? '';
  });
  return names;
};

/**
 * Fold every product's ingredient copies into one entry per logical ingredient, sauces first by
 * kind and then alphabetically by the folded default name.
 *
 * The join is TWO-pass, because provenance is mid-migration on every real tenant: the picker and
 * the save-time reconciliation stamp `globalIngredientId` on new copies, while everything typed
 * before that slice carries only a name. One walk would file the id-carrying copy of "Sans
 * Sauces" under `id:g1` and its name-only siblings under `name:sans sauces` — two rows for one
 * ingredient, which is the exact fragmentation this screen exists to undo. So: id-carrying copies
 * found their groups first; a name-only copy then joins the first id-group whose folded names
 * include its own, and only falls back to a name-keyed group when no such group exists. Two
 * DIFFERENT library ids sharing one folded name keep two groups deliberately — the library row is
 * the save target, and one save must never reach rows provenance says belong to another row.
 */
export function buildIngredientEntries(products: readonly IngredientCarrierProduct[]): IngredientEntry[] {
  type DraftGroup = {
    globalIngredientId?: string;
    defaultName: string;
    isSauce: boolean;
    foldedNames: Set<string>;
    copies: IngredientCopyUsage[];
    names: Record<string, Record<string, string>>;
  };
  const groups = new Map<string, DraftGroup>();

  const admit = (group: DraftGroup, product: IngredientCarrierProduct, ingredient: ProductIngredient) => {
    group.isSauce = group.isSauce || resolveIngredientKind(ingredient) === 'sauce';
    group.copies.push({
      productId: product.id,
      productName: product.name ?? '',
      ingredientId: ingredient.id,
    });
    group.names[ingredient.id] = copyNames(ingredient);
  };

  const newGroup = (ingredient: ProductIngredient): DraftGroup => ({
    globalIngredientId: ingredient.globalIngredientId,
    defaultName: ingredient.name ?? '',
    isSauce: false,
    foldedNames: new Set([fold(ingredient.name ?? '')]),
    copies: [],
    names: {},
  });

  // Pass 1 — provenance-carrying copies found the `id:` groups.
  products.forEach((product) => {
    (product.detailedIngredients ?? []).forEach((ingredient) => {
      if (!ingredient.globalIngredientId) return;
      const key = `id:${ingredient.globalIngredientId}`;
      let group = groups.get(key);
      if (!group) {
        group = newGroup(ingredient);
        groups.set(key, group);
      }
      group.foldedNames.add(fold(ingredient.name ?? ''));
      admit(group, product, ingredient);
    });
  });

  // Pass 2 — legacy copies join an id-group by folded name, else found a `name:` group.
  products.forEach((product) => {
    (product.detailedIngredients ?? []).forEach((ingredient) => {
      if (ingredient.globalIngredientId) return;
      const folded = fold(ingredient.name ?? '');
      const withId = [...groups.values()].find(
        (candidate) => candidate.globalIngredientId && candidate.foldedNames.has(folded),
      );
      let key = `name:${folded}`;
      let group: DraftGroup | undefined;
      if (withId) {
        group = withId;
        key = `id:${withId.globalIngredientId}`;
      } else {
        group = groups.get(key);
      }
      if (!group) {
        group = newGroup({ ...ingredient, globalIngredientId: undefined });
        groups.set(key, group);
      }
      admit(group, product, ingredient);
    });
  });

  const entries: IngredientEntry[] = [];
  groups.forEach((group, key) => {
    const cells: Record<string, LocaleCell> = {};
    LANGUAGE_CODES.forEach((code) => {
      const readings = group.copies
        .map((copy) => group.names[copy.ingredientId][code])
        .filter((name) => name.length > 0);
      const value = readings[0] ?? '';
      cells[code] = {
        value,
        disagreements: readings.filter((name) => name !== value).length,
        missing: group.copies.length - readings.length,
      };
    });
    entries.push({
      key,
      globalIngredientId: group.globalIngredientId,
      defaultName: group.defaultName,
      isSauce: group.isSauce,
      copies: group.copies,
      cells,
    });
  });

  return entries.sort(
    (a, b) => Number(b.isSauce) - Number(a.isSauce) || fold(a.defaultName).localeCompare(fold(b.defaultName)),
  );
}

/** The payload one save sends: every locale the admin left non-blank, blank meaning "leave alone". */
export function translationsForSave(
  entry: IngredientEntry,
  edits: Readonly<Record<string, string>>,
): { languageCode: string; name: string }[] {
  return LANGUAGE_CODES.map((code) => [code, edits[code] ?? entry.cells[code].value] as const)
    .filter(([, name]) => name.length > 0)
    .map(([languageCode, name]) => ({ languageCode, name }));
}

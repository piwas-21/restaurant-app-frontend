'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import LibraryKindScopeNotice from './LibraryKindScopeNotice';
import LibraryPickerShell from './LibraryPickerShell';
import { type LibraryPickerView } from './LibraryPickerToolbar';
import { INGREDIENT_LIBRARY_COPY } from './libraryPickerCopy';
import { useGlobalIngredientLibrary } from '@/hooks/admin/useGlobalIngredientLibrary';
import { useGlobalIngredientArchive } from '@/hooks/admin/useGlobalIngredientArchive';
import { createGlobalIngredient } from '@/services/globalIngredientService';
import { attachGlobalIngredient, getGlobalIngredientProducts } from '@/services/libraryAttachService';
import { toProductIngredient } from './globalIngredientLibrary';
import { DEFAULT_INGREDIENT_KIND } from '@/utils/ingredientKind';
import type { IngredientKind, ProductIngredient } from '@/types/menu';

interface GlobalIngredientPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The product's current rows — what "already added" is measured against. */
  attached: ProductIngredient[];
  /** Receives the picked rows, already mapped to product ingredients. */
  onAdd: (ingredients: ProductIngredient[]) => void;
  /** The GROUP the picker was opened from (plan D8) — every picked row is stamped with it. */
  kind?: IngredientKind;
}

/**
 * Browse the global ingredient library and attach rows to the product (plan S2), and keep it tidy
 * (plan S3).
 *
 * The library has been seeded with 654 entries in 9 languages since the GlobalIngredients migration
 * and no screen ever listed it: the only way in was a per-row type-ahead that needs you to guess the
 * English name first. Picking a row here copies its name and its translations onto the product — the
 * 10 free-text translation inputs this saves per ingredient are the whole point — and records
 * `globalIngredientId` as provenance. Copy semantics (plan D3): what is attached is the product's own
 * from that moment, and a later edit of the library row does NOT propagate — that needs the frozen
 * order history and is a later slice.
 *
 * S3 adds the two things a catalog nobody can prune eventually needs: what each row costs to change
 * ("used on N items"), and a way to retire one. Retiring is soft in every case (plan D4) and
 * reversible from the Archived view, so nothing an admin does here can reach a product that already
 * copied the row, let alone a past order.
 *
 * The picker itself is `LibraryPickerShell`, shared with the variation library since plan S4. What
 * is left here is what makes it the INGREDIENT picker: two hooks over two endpoints, and the
 * mapping onto a product row.
 */
export default function GlobalIngredientPickerModal({
  isOpen,
  onClose,
  attached,
  onAdd,
  kind = DEFAULT_INGREDIENT_KIND,
}: Readonly<GlobalIngredientPickerModalProps>) {
  const { i18n } = useTranslation();
  const [view, setView] = useState<LibraryPickerView>('active');
  const library = useGlobalIngredientLibrary({
    isOpen,
    attached,
    languageCode: i18n.language,
    kind,
    // The third shelf (backend D14). It matters most here: a tenant's own handful of rows are three
    // entries among 654 seeded ones, so without it they are findable only by remembering the word.
    tenantOwnedOnly: view === 'mine',
  });
  const archive = useGlobalIngredientArchive({
    isOpen,
    isViewingArchive: view === 'archived',
    onCatalogChanged: library.reload,
  });

  return (
    <LibraryPickerShell
      isOpen={isOpen}
      onClose={onClose}
      copy={INGREDIENT_LIBRARY_COPY}
      library={library}
      archive={archive}
      view={view}
      onViewChange={setView}
      // The GROUP the picker was opened from, so a name typed into Sauces is filed in the library
      // AS A SAUCE. Omitting it is what made the shelf 654 ingredients and 0 sauces on a live
      // tenant: the backend defaults an absent kind to `ingredient`, so the sauce-ness was lost the
      // moment the row left the product it was typed on.
      createRow={(defaultName) => createGlobalIngredient({ defaultName, translations: [], kind })}
      onAdd={(picked) => onAdd(picked.map((row, index) => toProductIngredient(row, attached.length + index, kind)))}
      scopeNotice={
        <LibraryKindScopeNotice
          kind={kind}
          isScoped={library.isScoped}
          hiddenCount={library.scopeHiddenCount}
          onChange={library.setScoped}
        />
      }
      apply={{
        fetchUsage: getGlobalIngredientProducts,
        attach: (id, productIds) =>
          attachGlobalIngredient(id, {
            productIds,
            // The GROUP the picker was opened from, so applying one sauce to twenty-one products
            // lands twenty-one SAUCES (slice G3). The endpoint used to stamp the library row's own
            // kind while this modal's other write stamped the group — two shipped paths, opposite
            // rules. Both now read "the action states the kind"; the catalog row is only the
            // fallback for a caller that has no group to state.
            kind,
            // The per-product facts the bulk body carries (plan D1). `isOptional` is `true` because
            // the backend refuses anything else on this path — a required ingredient is rendered as
            // REMOVED on every order placed before it existed — and the price is 0 because the
            // catalog knows none: this attaches the WORDS to forty products, and the money stays a
            // per-product edit rather than one number guessed for all of them.
            isOptional: true,
            price: 0,
            maxQuantity: 1,
            isIncludedInBasePrice: false,
          }),
      }}
    />
  );
}

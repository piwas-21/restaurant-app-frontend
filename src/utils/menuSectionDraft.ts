import type { MenuDefinition, MenuSection } from '@/types/menu';

/**
 * The bundle menu-section shapes carried in a create/update request — a persisted id is present
 * only for rows that already exist server-side (client-draft rows use `temp-…` ids that must not
 * be sent).
 */
export interface CleanMenuSectionItem {
  id?: string;
  productId: string;
  additionalPrice: number;
  displayOrder: number;
  isDefault: boolean;
}

export interface CleanMenuSection {
  id?: string;
  name: string;
  description?: string;
  displayOrder: number;
  isRequired: boolean;
  minSelection: number;
  maxSelection: number;
  items: CleanMenuSectionItem[];
}

/** A real, persisted id — i.e. present and not a client-side `temp-…` placeholder. */
export function isPersistedMenuId(id: string | undefined | null): id is string {
  return !!id && !id.startsWith('temp-');
}

/**
 * Strip client-side temporary (`temp-…`) ids from a bundle's draft sections/items so a create/update
 * request only carries real (persisted) ids — a new row omits its id and the backend inserts it.
 * Deduplicated verbatim from `EditMenuBundleModal` and `MenuBundleDetails` (menu-bundles redesign
 * #176, slice 7). Behaviour-identical to both former inline blocks; the fuller draft-state hook
 * (`useMenuSectionDraft`) consolidates in slice 7 PR2 with the unified editor.
 */
export function stripTemporaryMenuSectionIds(sections: readonly MenuSection[]): CleanMenuSection[] {
  return sections.map((section) => {
    const cleaned: CleanMenuSection = {
      name: section.name,
      description: section.description,
      displayOrder: section.displayOrder,
      isRequired: section.isRequired,
      minSelection: section.minSelection,
      maxSelection: section.maxSelection,
      items: section.items.map((item) => {
        const cleanedItem: CleanMenuSectionItem = {
          productId: item.productId,
          additionalPrice: item.additionalPrice,
          displayOrder: item.displayOrder,
          isDefault: item.isDefault,
        };
        if (isPersistedMenuId(item.id)) {
          cleanedItem.id = item.id;
        }
        return cleanedItem;
      }),
    };
    if (isPersistedMenuId(section.id)) {
      cleaned.id = section.id;
    }
    return cleaned;
  });
}

/**
 * A bundle's draft menu definition in the shape the create/update endpoints accept: every
 * `temp-…` section and item id stripped, and the definition's own temp id dropped so the backend
 * assigns one. Both are 400s if sent — `MenuSectionItemDto.Id` and the definition id are `Guid?`,
 * so STJ fails the conversion before any handler sees the request.
 *
 * Lifted out of `useProductEditorForm.onSubmit` unchanged, to sit beside the two helpers it is
 * built from (that hook is at its 200-line limit, and the block was already pure).
 */
export function toSubmittableMenuDefinition(menuDefinition: MenuDefinition): Record<string, unknown> {
  const definition: Record<string, unknown> = {
    ...menuDefinition,
    sections: stripTemporaryMenuSectionIds(menuDefinition.sections),
  };
  if (!isPersistedMenuId(menuDefinition.id)) delete definition.id;
  return definition;
}

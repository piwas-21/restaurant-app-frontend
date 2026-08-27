import type { TFunction } from 'i18next';
import type { useProductEditorForm } from '@/hooks/admin/useProductEditorForm';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';

/**
 * What every section builder is handed (MENU-ITEM-EDITOR-REDESIGN-PLAN S1/S2).
 *
 * Its own module so that the item sections and the dispatcher can share it without importing each
 * other — a cycle between two modules that both build React nodes is the kind of thing that only
 * fails at runtime, in one bundler, on one route.
 */
export interface EditorSectionsContext {
  readonly editor: ReturnType<typeof useProductEditorForm>;
  readonly t: TFunction;
  readonly product: ProductDetails;
  readonly isCreate: boolean;
  readonly isBundle: boolean;
}

/**
 * Section ids are DOM ids — the nav scrolls to them and the collapse preference is stored under
 * them, so renaming one silently discards a user's remembered choice for that section.
 *
 * The order of the KEYS is the order of §4's seven sections, and `buildItemSections` renders them
 * in exactly that order: Basics · Media · Pricing & variations · Options & sides · Recipe &
 * dietary · Service & availability · Advanced.
 */
export const SECTION_IDS = {
  basics: 'editor-section-basics',
  media: 'editor-section-media',
  pricing: 'editor-section-pricing',
  options: 'editor-section-options',
  recipe: 'editor-section-recipe',
  service: 'editor-section-service',
  advanced: 'editor-section-advanced',
} as const;

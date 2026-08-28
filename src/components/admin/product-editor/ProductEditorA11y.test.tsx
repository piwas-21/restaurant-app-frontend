import React from 'react';
import { act, render } from '@testing-library/react';
import ProductEditorPage from './ProductEditorPage';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('@/services/productService', () => ({
  updateProduct: jest.fn(async () => ({ success: true })),
  uploadBulkProductImages: jest.fn(async () => ({ success: true })),
  updateProductImageDetails: jest.fn(async () => ({ success: true })),
  deleteProductImage: jest.fn(async () => ({ success: true })),
}));
jest.mock('@/services/menuService', () => ({ createProduct: jest.fn() }));
jest.mock('@/services/menuBundleService', () => ({ createMenuBundle: jest.fn(), updateMenuBundle: jest.fn() }));
jest.mock('@/services/globalIngredientService', () => ({
  createGlobalIngredient: jest.fn(),
  searchGlobalIngredients: jest.fn(async () => ({ success: true, data: [] })),
}));
jest.mock('@/services/categoryService', () => ({
  getCategories: jest.fn(async () => ({ success: true, data: { items: [{ id: 'cat-a', name: 'Pizza' }] } })),
}));

const item: ProductDetails = {
  id: 'item-1',
  name: 'Margherita',
  description: 'A pizza',
  basePrice: 12,
  isActive: true,
  isAvailable: true,
  isSpecial: false,
  preparationTimeMinutes: 10,
  type: 'mainItem',
  ingredients: [],
  allergens: [],
  categories: [{ categoryId: 'cat-a', categoryName: 'Pizza', isPrimary: true }],
  primaryCategory: { id: 'cat-a', name: 'Pizza' },
  // One variation, because `ProductVariations` is where the unlabelled inputs were densest.
  variations: [{ id: 'v1', name: 'Large', priceModifier: 2, finalPrice: 14, isActive: true, displayOrder: 0 }],
  images: [],
  suggestedSideItems: [],
  content: { en: { name: 'Margherita', description: 'A pizza' } },
} as ProductDetails;

/**
 * axe's `label` and `select-name` rules, re-stated as a structural assertion.
 *
 * These are the "any" checks both rules pass on, in axe-core's own order: an explicit `label[for]`,
 * an implicit (wrapping) label, `aria-label`, `aria-labelledby`, `title`, and — for `label` only,
 * as a last resort — a non-empty `placeholder`. Re-implemented rather than imported because
 * `axe-core` is only a TRANSITIVE dependency here (via `@axe-core/playwright`), and a unit test
 * that silently stops running after a dedupe is worse than one that states its own rule.
 */
const hasAccessibleName = (control: HTMLElement): boolean => {
  const id = control.getAttribute('id');
  if (id && control.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`)) return true;
  if (control.closest('label')) return true;
  if (control.getAttribute('aria-label')?.trim()) return true;
  const labelledBy = control.getAttribute('aria-labelledby');
  if (labelledBy && labelledBy.split(/\s+/).some((ref) => control.ownerDocument.getElementById(ref))) return true;
  if (control.getAttribute('title')?.trim()) return true;
  return Boolean(control.getAttribute('placeholder')?.trim());
};

/**
 * What axe actually scans: controls exposed to assistive tech.
 *
 * Two exclusions, both matching axe's own behaviour:
 *
 * - a `[hidden]` subtree — the collapsed `Advanced` body and the inactive tab panel, which stay
 *   MOUNTED on purpose (a registered field that unmounts is a value the PUT clears, plan §6);
 * - the `hiddenInput` idiom. `ImageUploadPanel.module.css` documents it: the file input is
 *   `display: none` and driven by a button, *"it is never the labelled control — the button is —
 *   so keeping it in the a11y tree would announce a duplicate"*. axe skips it; jsdom cannot see it,
 *   because CSS Modules are stubbed by `identity-obj-proxy` and there is no layout. Matching the
 *   class is therefore the only honest way to model the same exclusion here.
 */
const visibleControls = (root: HTMLElement): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>('input:not([type="hidden"]), select, textarea')].filter(
    (control) => !control.closest('[hidden]') && !control.closest('[class*="hiddenInput"]'),
  );

/**
 * Issue #592, item 1 — measured on a real stack with axe: the editor reported `label` (critical)
 * and `select-name` (critical), because its fields render a bare `<label>{t('product_name')}</label>`
 * with no `htmlFor` and no wrapping. A screen reader announced "edit text".
 *
 * S7 (D13) is the slice whose definition of done includes `label htmlFor` everywhere, so this is
 * that item's regression guard: every control the editor shows must be nameable. It is deliberately
 * a JSDOM test rather than a note on a Playwright run — the e2e scan proves the page today, this
 * proves the components tomorrow, and a control added without a label fails HERE, in the PR that
 * adds it.
 *
 * It does NOT cover `color-contrast`, #592's third rule: contrast needs layout and real computed
 * colours, which jsdom does not have. That half stays with #592.
 */
describe('product editor — every visible control has an accessible name (#592, item 1)', () => {
  it('names every input, select and textarea on the Item tab', async () => {
    const { container } = render(
      <ProductEditorPage product={item} isBundle={false} onSaved={jest.fn()} onBack={jest.fn()} />,
    );
    await act(async () => {});

    const controls = visibleControls(container);
    // A guard on the guard: if a refactor stops rendering the form, an empty list would pass
    // vacuously — which is exactly how this defect survived a green suite for so long.
    expect(controls.length).toBeGreaterThan(8);

    const unnamed = controls.filter((control) => !hasAccessibleName(control));
    // The failure message has to name the offender, or a red run is a scavenger hunt.
    const describe_ = (control: HTMLElement) => control.outerHTML.slice(0, 160);

    expect(unnamed.map(describe_)).toEqual([]);
  });
});

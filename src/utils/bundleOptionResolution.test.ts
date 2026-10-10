import { toggleBundleOption } from './bundleSelection';
import {
  removeUnresolvedBundleOptionSelections,
  resolveBundleOptionSelections,
  resolveBundleRowSelection,
  resolveSelectedBundleOption,
} from './bundleOptionResolution';
import type { MenuSection, MenuSectionItem, SelectedMenuOption } from '@/types/menu';

const row = (id: string, variation: string | null = null): MenuSectionItem => ({
  id,
  productId: 'burger',
  productName: 'Burger',
  productVariationId: variation,
  additionalPrice: 0,
  displayOrder: 1,
  isDefault: true,
});

const section = (...items: MenuSectionItem[]): MenuSection => ({
  id: 'main',
  name: 'Main',
  displayOrder: 1,
  isRequired: true,
  minSelection: 1,
  maxSelection: 2,
  items,
});

const legacySelection = (overrides: Partial<SelectedMenuOption> = {}): SelectedMenuOption => ({
  sectionId: 'main',
  itemId: 'burger',
  quantity: 1,
  componentProductVariationId: 'large',
  selectedIngredients: ['cheese'],
  specialInstructions: 'No onions',
  ...overrides,
});

describe('resolveBundleOptionSelections', () => {
  it('canonically binds a unique legacy reference without mutating its draft', () => {
    const draft = legacySelection();
    const [resolution] = resolveBundleOptionSelections([section(row('row-a'))], [draft]);

    expect(resolution).toMatchObject({ status: 'resolved', item: { id: 'row-a' } });
    expect(resolution.canonicalSelection).toEqual({ ...draft, menuSectionItemId: 'row-a' });
    expect(draft).not.toHaveProperty('menuSectionItemId');
  });

  it('uses the fixed variation to distinguish otherwise duplicated product rows', () => {
    const [resolution] = resolveBundleOptionSelections(
      [section(row('regular-row', 'regular-fixed'), row('large-row', 'large-fixed'))],
      [legacySelection({ productVariationId: 'large-fixed' })],
    );

    expect(resolution).toMatchObject({ status: 'resolved', item: { id: 'large-row' } });
  });

  it('marks a legacy product reference ambiguous when duplicate catalogue rows match', () => {
    const [resolution] = resolveBundleOptionSelections([section(row('row-a'), row('row-b'))], [legacySelection()]);

    expect(resolution).toMatchObject({ status: 'unresolved', reason: 'ambiguous-row' });
    expect(resolution.canonicalSelection).toBeUndefined();
  });

  it('does not downgrade an explicit stale row ID to the unique legacy match', () => {
    const stale = legacySelection({ menuSectionItemId: 'removed-row' });
    const [resolution] = resolveBundleOptionSelections([section(row('current-row'))], [stale]);

    expect(resolution).toMatchObject({ status: 'unresolved', reason: 'stale-row' });
  });

  it('marks duplicate unresolved drafts as recovery cases instead of assigning either one', () => {
    const [first, second] = resolveBundleOptionSelections(
      [section(row('row-a'))],
      [legacySelection(), legacySelection({ selectedIngredients: ['lettuce'] })],
    );

    expect(first).toMatchObject({ status: 'unresolved', reason: 'duplicate-selection' });
    expect(second).toMatchObject({ status: 'unresolved', reason: 'duplicate-selection' });
  });

  it('keeps uniquely resolvable legacy drafts during recovery cleanup and preserves them unchanged', () => {
    const unique = legacySelection({ sectionId: 'other-section', itemId: 'other-product' });
    const stale = legacySelection({ menuSectionItemId: 'removed-row' });
    const sections = [
      section(row('row-a')),
      { ...section({ ...row('other-row'), productId: 'other-product' }), id: 'other-section' },
    ];
    const selections = [unique, stale];
    const retained = removeUnresolvedBundleOptionSelections(sections, selections);

    expect(retained).toEqual([unique]);
    expect(retained[0]).toBe(unique);
    expect(unique).not.toHaveProperty('menuSectionItemId');
    expect(selections).toEqual([unique, stale]);
  });
});

describe('explicit recovery selection', () => {
  it('preserves a legacy draft and binds it only after the guest clicks a specific duplicate row', () => {
    const current = section(row('row-a'), row('row-b'));
    const draft = legacySelection();
    const rowChoice = resolveBundleRowSelection(current, [draft], current.items[1]);

    expect(rowChoice).toMatchObject({ recoverableIndex: 0, unresolvedCount: 1 });
    const next = toggleBundleOption(current, [draft], 'burger', null, 'row-b');

    expect(next).toEqual([{ ...draft, menuSectionItemId: 'row-b' }]);
    expect(resolveBundleOptionSelections([current], next)[0].status).toBe('resolved');
  });

  it('does not choose between duplicate legacy drafts on the guest’s behalf', () => {
    const current = section(row('row-a'), row('row-b'));
    const drafts = [legacySelection(), legacySelection({ selectedIngredients: ['lettuce'] })];
    const rowChoice = resolveBundleRowSelection(current, drafts, current.items[1]);

    expect(rowChoice).toMatchObject({ unresolvedCount: 2 });
    expect(rowChoice.recoverableIndex).toBeUndefined();
    expect(toggleBundleOption(current, drafts, 'burger', null, 'row-b')).toEqual(drafts);
  });
});

describe('selected-option locator resolution', () => {
  it('returns a canonical stable row for one uniquely matching legacy option', () => {
    const sections = [section(row('row-a'))];
    const result = resolveSelectedBundleOption(sections, [legacySelection()], {
      sectionId: 'main',
      itemId: 'burger',
    });

    expect(result?.canonicalSelection?.menuSectionItemId).toBe('row-a');
  });

  it('does not locate an ambiguous legacy option or a stale explicit row by product alone', () => {
    const sections = [section(row('row-a'), row('row-b'))];
    expect(
      resolveSelectedBundleOption(sections, [legacySelection()], { sectionId: 'main', itemId: 'burger' }),
    ).toBeUndefined();
    expect(
      resolveSelectedBundleOption(sections, [legacySelection({ menuSectionItemId: 'removed-row' })], {
        sectionId: 'main',
        itemId: 'burger',
      }),
    ).toBeUndefined();
  });
});

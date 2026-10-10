import type { MenuSection, ProductCustomizationGroup, SuggestedSideItem } from '@/types/menu';
import { defaultBundleStepManifestParts, defaultProductStepManifestParts } from './customerStepManifest';

const group = (id: string, required: boolean): ProductCustomizationGroup => ({
  id,
  name: id,
  displayOrder: required ? 1 : 0,
  isRequired: required,
  minSelection: required ? 1 : 0,
  maxSelection: 1,
  includedFreeUnits: 0,
  isActive: true,
  content: {},
  ingredientOptions: [],
  productOptions: [],
});

const drink: SuggestedSideItem = {
  id: 'drink-product',
  suggestedSideItemId: 'drink-association',
  name: 'Cola',
  price: 2,
  isRequired: false,
  displayOrder: 0,
  type: 'beverage',
};

describe('default customer step manifests', () => {
  it('preserves standalone Drink metadata and places required groups before Extras', () => {
    const steps = defaultProductStepManifestParts({
      groups: [group('extra', false), group('required', true)],
      sides: [drink],
    });
    const required = steps.find((step) => step.kind === 'ProductCustomizationGroup' && step.targetId === 'required');
    const extra = steps.find((step) => step.kind === 'ProductCustomizationGroup' && step.targetId === 'extra');
    const side = steps.find((step) => step.kind === 'ProductSuggestedSide');

    expect(required?.presentationOrder ?? Number.MAX_SAFE_INTEGER).toBeLessThan(extra?.presentationOrder ?? -1);
    expect(side).toMatchObject({
      kind: 'ProductSuggestedSide',
      targetId: 'drink-association',
      compositionRole: 'Drink',
    });
  });

  it('places required component groups before Extras and keeps beverage rows authored as Drink', () => {
    const section: MenuSection = {
      id: 'dishes',
      name: 'Dishes',
      displayOrder: 0,
      isRequired: true,
      minSelection: 1,
      maxSelection: 1,
      items: [
        {
          id: 'dish-row',
          productId: 'dish-product',
          productName: 'Dish',
          additionalPrice: 0,
          displayOrder: 0,
          isDefault: true,
          customizationGroups: [group('extra', false), group('required', true)],
          suggestedSideItems: [
            {
              id: 'drink-association',
              sideItemProductId: 'drink-product',
              sideItemProductName: 'Cola',
              sideItemBasePrice: 2,
              sideItemProductType: 'beverage',
              isRequired: false,
              displayOrder: 0,
            },
          ],
        },
      ],
    };
    const steps = defaultBundleStepManifestParts([section]);
    const required = steps.find(
      (step) => step.kind === 'BundleComponentCustomizationGroup' && step.scopeId === 'required',
    );
    const extra = steps.find((step) => step.kind === 'BundleComponentCustomizationGroup' && step.scopeId === 'extra');
    const side = steps.find((step) => step.kind === 'BundleComponentSide');

    expect(required?.presentationOrder ?? Number.MAX_SAFE_INTEGER).toBeLessThan(extra?.presentationOrder ?? -1);
    expect(side).toMatchObject({ kind: 'BundleComponentSide', scopeId: 'drink-association', compositionRole: 'Drink' });
  });
});

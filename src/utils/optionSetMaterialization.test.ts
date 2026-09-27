import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import type { OptionSetAttachment } from '@/types/optionSet';
import { targetFromAttachment, targetsForProduct } from './optionSetMaterialization';
import { makeOptionSetMaterializationRequest } from './optionSetMaterializationRequest';

const product = {
  id: 'bundle-1',
  name: 'Lunch menu',
  menuDefinition: {
    authoringVersion: 8,
    sections: [{ id: 'section-1', name: 'Main', minSelection: 1, maxSelection: 1, displayOrder: 0 }],
  },
  customizationGroups: [
    {
      id: 'group-1',
      authoringVersion: 3,
      name: 'Sauce choice',
      minSelection: 0,
      maxSelection: 2,
      includedFreeUnits: 1,
      displayOrder: 2,
    },
  ],
} as unknown as ProductDetails;

describe('optionSetMaterialization', () => {
  it('serializes exact menu-section and product-choice contexts with version watermarks', () => {
    const targets = targetsForProduct(product, 'bundleChoice');
    const request = makeOptionSetMaterializationRequest(5, 'attempt-1', targets, ['entry-1']);

    expect(targets.map(({ role, contextId }) => [role, contextId])).toEqual([
      ['bundleChoice', 'section-1'],
      ['productChoice', 'group-1'],
    ]);
    expect(request).toEqual({
      expectedSetVersion: 5,
      idempotencyKey: 'attempt-1',
      targets: [
        {
          targetKey: 'bundleChoice:bundle-1:section-1',
          role: 'bundleChoice',
          targetProductId: 'bundle-1',
          targetMenuSectionId: 'section-1',
          expectedMenuAuthoringVersion: 8,
          expectedAttachmentVersion: null,
          entryIds: ['entry-1'],
          conflictPolicy: 'preserveLocal',
          settings: { minSelection: 1, maxSelection: 1, displayOrder: 0 },
        },
        {
          targetKey: 'productChoice:bundle-1:group-1',
          role: 'productChoice',
          targetProductId: 'bundle-1',
          targetCustomizationGroupId: 'group-1',
          expectedCustomizationGroupVersion: 3,
          expectedAttachmentVersion: null,
          entryIds: ['entry-1'],
          conflictPolicy: 'preserveLocal',
          settings: { minSelection: 0, maxSelection: 2, includedFree: 1, displayOrder: 2 },
        },
      ],
    });
  });

  it('omits fields that do not belong to ingredient attachments', () => {
    const attachment: OptionSetAttachment = {
      id: 'attachment-1',
      role: 'ingredient',
      targetProductId: 'product-1',
      appliedSetVersion: 2,
      version: 4,
      displayOrder: 7,
    };
    const target = targetFromAttachment(attachment, { ...product, id: 'product-1' });
    expect(target?.settings).toEqual({});
    expect(target?.expectedAttachmentVersion).toBe(4);
  });

  it('does not create a request for an unversioned target context', () => {
    const unversioned = targetsForProduct(
      {
        ...product,
        menuDefinition: {
          id: 'menu-1',
          authoringVersion: undefined,
          sections: product.menuDefinition?.sections ?? [],
        } as NonNullable<ProductDetails['menuDefinition']>,
        customizationGroups: [],
      },
      'bundleChoice',
    );
    expect(unversioned[0].selected).toBe(false);
    expect(makeOptionSetMaterializationRequest(1, 'attempt-2', unversioned, ['entry-1'])).toBeNull();
  });

  it('preserves explicit sauce max-selection clearing in the request', () => {
    const target = {
      ...targetsForProduct(
        { ...product, id: 'product-1', menuDefinition: undefined, customizationGroups: [] },
        'ingredient',
      )[0],
      role: 'sauce' as const,
      targetKey: 'sauce:product-1:root',
      settings: { clearMaxSelection: true },
    };
    const request = makeOptionSetMaterializationRequest(2, 'attempt-clear', [target], ['entry-1']);

    expect(request?.targets[0].settings).toEqual({ clearMaxSelection: true });
  });
});

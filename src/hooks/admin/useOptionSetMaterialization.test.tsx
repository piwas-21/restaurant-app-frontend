import { act, renderHook, waitFor } from '@testing-library/react';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import type { OptionSetDetail } from '@/types/optionSet';
import type { OptionSetMaterializationPreview, OptionSetMaterializationResult } from '@/types/optionSetMaterialization';
import { applyOptionSetAttachments, previewOptionSetAttachments } from '@/services/optionSetService';
import { getOptionSetTargetProducts } from '@/services/optionSetTargetService';
import { useOptionSetMaterializationFeature } from './useOptionSetMaterializationFeature';
import { useOptionSetMaterialization } from './useOptionSetMaterialization';

jest.mock('@/services/optionSetService', () => ({
  applyOptionSetAttachments: jest.fn(),
  previewOptionSetAttachments: jest.fn(),
}));
jest.mock('@/services/optionSetTargetService', () => ({ getOptionSetTargetProducts: jest.fn() }));
jest.mock('./useOptionSetMaterializationFeature', () => ({ useOptionSetMaterializationFeature: jest.fn() }));

const detail: OptionSetDetail = {
  id: 'set-1',
  kind: 'bundleChoice',
  name: 'Meal choices',
  status: 'active',
  version: 4,
  entryCount: 1,
  attachmentCount: 0,
  entries: [
    {
      id: 'entry-1',
      name: 'Soup',
      displayOrder: 0,
      isOptional: false,
      maxQuantity: 1,
      price: 0,
      isIncludedInBasePrice: false,
      isRequired: true,
      additionalPrice: 0,
      isDefault: false,
    },
  ],
  attachments: [],
};
const product = {
  id: 'bundle-1',
  name: 'Lunch bundle',
  menuDefinition: {
    id: 'menu-1',
    authoringVersion: 7,
    sections: [{ id: 'section-1', name: 'Side', minSelection: 1, maxSelection: 1, displayOrder: 0 }],
  },
} as unknown as ProductDetails;
const preview: OptionSetMaterializationPreview = {
  optionSetId: 'set-1',
  setVersion: 4,
  targets: [
    {
      targetKey: 'bundleChoice:bundle-1:section-1',
      targetProductId: 'bundle-1',
      targetMenuSectionId: 'section-1',
      status: 'ready',
      conflicts: [],
      currentSettings: {},
      proposedSettings: {},
      changedSettings: [],
      changes: [
        { entryId: 'entry-1', rowType: 'MenuSectionItem', action: 'add', changedFields: ['name'], preservedFields: [] },
      ],
    },
  ],
  relatedOfferWarnings: [
    {
      targetKey: 'bundleChoice:bundle-1:section-1',
      relatedProductId: 'standalone-1',
      relatedProductName: 'Soup',
      relatedOfferType: 'standalone',
      relatedTargetRole: 'productChoice',
      relatedTargetId: null,
      relatedTargetName: null,
      reasonRequired: true,
    },
  ],
};
const result: OptionSetMaterializationResult = {
  optionSetId: 'set-1',
  setVersion: 4,
  targets: [
    {
      targetKey: 'bundleChoice:bundle-1:section-1',
      status: 'applied',
      attachmentId: 'attachment-1',
      attachmentVersion: 1,
      menuAuthoringVersion: 8,
      appliedRows: [{ entryId: 'entry-1', rowType: 'MenuSectionItem', rowId: 'row-1', action: 'add' }],
      conflicts: [],
    },
  ],
};

const materializationFeature = jest.mocked(useOptionSetMaterializationFeature);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getOptionSetTargetProducts).mockResolvedValue({ loaded: {}, failed: {} });
  jest.mocked(previewOptionSetAttachments).mockResolvedValue(preview);
  jest.mocked(applyOptionSetAttachments).mockResolvedValue(result);
});

describe('useOptionSetMaterialization', () => {
  it('allows preview while the feature is off and fails closed on apply', async () => {
    materializationFeature.mockReturnValue({ enabled: false, isLoading: false, error: false, reload: jest.fn() });
    const { result: hook } = renderHook(() => useOptionSetMaterialization(detail, false, jest.fn()));
    await waitFor(() => expect(hook.current.isLoadingTargets).toBe(false));
    act(() => hook.current.addProduct(product));

    await act(async () => hook.current.runPreview());
    expect(previewOptionSetAttachments).toHaveBeenCalledWith(
      'set-1',
      expect.objectContaining({
        expectedSetVersion: 4,
        targets: [
          expect.objectContaining({
            role: 'bundleChoice',
            targetMenuSectionId: 'section-1',
            expectedMenuAuthoringVersion: 7,
            expectedAttachmentVersion: null,
          }),
        ],
      }),
    );
    expect(hook.current.canApply).toBe(false);
    await act(async () => hook.current.runApply());
    expect(applyOptionSetAttachments).not.toHaveBeenCalled();
  });

  it('requires a related-offer reason and applies exactly the previewed target with that reason', async () => {
    materializationFeature.mockReturnValue({ enabled: true, isLoading: false, error: false, reload: jest.fn() });
    const onApplied = jest.fn();
    const { result: hook } = renderHook(() => useOptionSetMaterialization(detail, false, onApplied));
    await waitFor(() => expect(hook.current.isLoadingTargets).toBe(false));
    act(() => hook.current.addProduct(product));
    await act(async () => hook.current.runPreview());

    expect(hook.current.missingReasonTargets).toEqual(['bundleChoice:bundle-1:section-1']);
    expect(hook.current.canApply).toBe(false);
    act(() =>
      hook.current.updateTarget(
        'bundleChoice:bundle-1:section-1',
        { intentionalDifferenceReason: 'Reviewed linked offer requirement' },
        true,
      ),
    );
    expect(hook.current.canApply).toBe(true);
    await act(async () => hook.current.runApply());

    expect(applyOptionSetAttachments).toHaveBeenCalledWith(
      'set-1',
      expect.objectContaining({
        targets: [
          expect.objectContaining({
            role: 'bundleChoice',
            targetMenuSectionId: 'section-1',
            expectedMenuAuthoringVersion: 7,
            intentionalDifferenceReason: 'Reviewed linked offer requirement',
          }),
        ],
      }),
    );
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(hook.current.result).toEqual(result);
  });
});

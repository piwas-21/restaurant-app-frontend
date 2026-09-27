import { OrderType } from '@/types/order';
import type { CatalogueImportSessionItem } from '@/services/catalogueImportService';
import {
  catalogueImportDecisionFor,
  catalogueImportDecisionForRequest,
  hasEmptyCustomOrderTypes,
  hasEmptyCustomOrderTypesInSelection,
} from './catalogueImportDecision';

const item = (availableOrderTypes?: number | null): CatalogueImportSessionItem => ({
  templateId: 'template-1',
  revision: 2,
  type: 'item',
  displayName: 'Soup',
  description: null,
  contentHash: 'hash',
  isRoot: true,
  isSelectable: true,
  isSelected: true,
  selectionRole: 'root',
  status: 'Pending',
  localEntityType: null,
  localEntityId: null,
  failureCode: null,
  decision: {
    templateId: 'template-1',
    revision: 2,
    resolution: 'Create',
    ...(availableOrderTypes !== undefined ? { availableOrderTypes } : {}),
  },
});

describe('catalogue import order channel wire mapping', () => {
  it('decodes the backend bitmask into editor channels and encodes the exact selected mask', () => {
    const decision = catalogueImportDecisionFor(item(5));
    expect(decision.availableOrderTypes).toEqual([OrderType.DineIn, OrderType.Delivery]);
    expect(catalogueImportDecisionForRequest(decision).availableOrderTypes).toBe(5);
  });

  it('preserves omitted and explicit null channel values', () => {
    expect(catalogueImportDecisionFor(item()).availableOrderTypes).toBeUndefined();
    expect(
      catalogueImportDecisionForRequest({
        templateId: 'template-1',
        revision: 2,
        resolution: 'Create',
        availableOrderTypes: null,
      }).availableOrderTypes,
    ).toBeNull();
  });

  it('detects an empty custom selection before a request can be sent', () => {
    expect(
      hasEmptyCustomOrderTypes({
        templateId: 'template-1',
        revision: 2,
        resolution: 'Create',
        availableOrderTypes: [],
      }),
    ).toBe(true);
    expect(
      hasEmptyCustomOrderTypes({
        templateId: 'template-1',
        revision: 2,
        resolution: 'Create',
        availableOrderTypes: null,
      }),
    ).toBe(false);
  });

  it('validates selected items against their editor decisions', () => {
    expect(
      hasEmptyCustomOrderTypesInSelection([item()], {
        'template-1@2': { templateId: 'template-1', revision: 2, resolution: 'Create', availableOrderTypes: [] },
      }),
    ).toBe(true);
    expect(hasEmptyCustomOrderTypesInSelection([], {})).toBe(false);
  });
});

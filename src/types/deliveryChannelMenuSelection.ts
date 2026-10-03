export type DeliveryChannelSelectionMode = 'fixedItemsV1' | 'categoryItemsV1';
export type DeliveryChannelCategoryBasis = 'primaryCategory';

export type DeliveryChannelCategorySelectionState = 'empty' | 'partial' | 'all';

export interface DeliveryChannelCategorySummary {
  readonly categoryId: string;
  readonly name: string;
  readonly displayOrder: number;
  readonly totalItemCount: number;
  readonly supportedItemCount: number;
  readonly unsupportedItemCount: number;
  readonly active?: boolean;
  readonly selectedItemCount?: number;
  readonly selectedUnsupportedItemCount?: number;
  readonly selectionState?: DeliveryChannelCategorySelectionState;
}

export interface DeliveryChannelCategoryItem {
  readonly selectionKey: string;
  readonly providerItemId: string;
  readonly productId: string;
  readonly variationId: string | null;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly categoryDisplayOrder: number;
  readonly itemDisplayOrder: number;
  readonly name: string;
  readonly variationName: string | null;
  readonly description?: string | null;
  readonly priceMinor: number | null;
  readonly available: boolean;
  readonly supported: boolean;
  readonly blockReason: string | null;
}

export interface DeliveryChannelCategoryCandidate extends Omit<
  DeliveryChannelCategoryItem,
  'providerItemId' | 'categoryId' | 'categoryName' | 'categoryDisplayOrder'
> {
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly categoryDisplayOrder: number | null;
}

export interface DeliveryChannelCategoryItemOverride {
  readonly selectionKey: string;
  readonly productId: string;
  readonly variationId: string | null;
  readonly categoryId: string;
  readonly selected: boolean;
  readonly supported: boolean;
}

export interface DeliveryChannelCategoryItemOverrideRequest {
  readonly productId: string;
  readonly variationId: string | null;
  readonly categoryId: string;
  readonly selected: boolean;
}

export interface DeliveryChannelCategoryDraft extends DeliveryChannelCategoryItemSet {
  readonly draftRevision: string;
  readonly sourceRevision: string;
  readonly language: string;
  readonly selectedCategoryIds: readonly string[];
  readonly itemOverrides: readonly DeliveryChannelCategoryItemOverride[];
  readonly categories: readonly DeliveryChannelCategorySummary[];
}

interface DeliveryChannelCategoryItemSet {
  readonly items: readonly DeliveryChannelCategoryItem[];
}

export interface DeliveryChannelCategoryInventory {
  readonly selectionMode: DeliveryChannelSelectionMode;
  readonly categoryBasis?: DeliveryChannelCategoryBasis;
  readonly maximumSelectedItemCount: number;
  readonly maximumCategoryCount: number;
  readonly maximumItemOverrideCount: number;
  readonly draftRevision?: string | null;
  readonly sourceRevision: string;
  readonly language: string;
  readonly categories: readonly DeliveryChannelCategorySummary[];
  readonly sourceChanged: boolean;
  readonly removedCategoryIds?: readonly string[];
  readonly removedItems?: readonly DeliveryChannelCategoryRemovedItemOverride[];
  readonly removedItemOverrides?: readonly DeliveryChannelCategoryRemovedItemOverride[];
  readonly itemStatuses?: readonly DeliveryChannelCategoryItemStatus[];
  readonly draft: DeliveryChannelCategoryDraft | null;
}

export interface DeliveryChannelCategoryCandidatePage {
  readonly categoryBasis?: DeliveryChannelCategoryBasis;
  readonly sourceRevision: string;
  readonly language: string;
  readonly nextCursor: string | null;
  readonly items: readonly DeliveryChannelCategoryCandidate[];
}

export interface DeliveryChannelCategoryReferenceRequest {
  readonly expectedSourceRevision: string;
  readonly categoryIds: readonly string[];
  readonly itemReferences: readonly Pick<DeliveryChannelCategoryItem, 'productId' | 'variationId' | 'categoryId'>[];
  readonly itemOverrides: readonly DeliveryChannelCategoryItemOverrideRequest[];
}

export interface DeliveryChannelCategoryRemovedItemOverride {
  readonly selectionKey: string;
  readonly productId: string;
  readonly variationId: string | null;
  readonly categoryId: string;
  readonly currentCategoryId: string | null;
  readonly reason: 'itemRemoved' | 'categoryRemoved' | 'categoryChanged';
}

export interface DeliveryChannelCategoryReferenceChanges {
  readonly categoryBasis?: DeliveryChannelCategoryBasis;
  readonly sourceRevision: string;
  readonly sourceChanged: boolean;
  readonly language: string;
  readonly maximumCategoryCount: number;
  readonly maximumItemOverrideCount: number;
  readonly categories: readonly DeliveryChannelCategorySummary[];
  readonly removedCategoryIds: readonly string[];
  readonly removedItems: readonly DeliveryChannelCategoryRemovedItemOverride[];
  readonly removedItemOverrides: readonly DeliveryChannelCategoryRemovedItemOverride[];
  readonly itemStatuses: readonly DeliveryChannelCategoryItemStatus[];
}

export interface DeliveryChannelCategoryItemStatus {
  readonly selectionKey: string;
  readonly productId: string;
  readonly variationId: string | null;
  readonly categoryId: string;
  readonly currentCategoryId: string | null;
  readonly supported: boolean;
}

export interface DeliveryChannelCategoryDraftRequest {
  readonly expectedDraftRevision: string | null;
  readonly items: readonly [];
  readonly expectedSourceRevision: string;
  readonly categoryIds: readonly string[];
  readonly itemOverrides: readonly DeliveryChannelCategoryItemOverrideRequest[];
}

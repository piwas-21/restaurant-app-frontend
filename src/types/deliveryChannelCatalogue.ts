/** Frontend mirror of the backend candidate DTOs used to guard menu selection. */
export interface DeliveryChannelCatalogueCandidate {
  readonly productId: string;
  readonly variationId: string | null;
  readonly name: string;
  readonly variationName: string | null;
  readonly priceMinor: number | null;
  readonly available: boolean;
  readonly supported: boolean;
  readonly blockReason: string;
}

export interface DeliveryChannelCatalogueCandidates {
  readonly currency: string;
  readonly language: string;
  readonly nextCursor: string | null;
  readonly items: readonly DeliveryChannelCatalogueCandidate[];
}

export interface DeliveryChannelTimePeriod {
  readonly startTime: string;
  readonly endTime: string;
}

export interface DeliveryChannelServiceHoursDay {
  readonly dayOfWeek: string;
  readonly timePeriods: readonly DeliveryChannelTimePeriod[];
}

export interface DeliveryChannelMappingRow {
  readonly providerItemId: string;
  readonly providerItemName: string;
  readonly productId: string | null;
  readonly variationId: string | null;
  readonly productName: string | null;
  readonly variationName: string | null;
  readonly tenantPriceMinor: number | null;
  readonly providerPriceMinor: number | null;
  readonly providerPriceStatus: 'currentReadback' | 'lastConfirmed' | 'unknown';
  readonly currency: string;
  readonly available: boolean;
  readonly mappingStatus: 'mapped' | 'unmapped' | 'blocked';
  readonly blockReason: string | null;
}

/** Frontend mirror of the management catalogue and draft DTOs. */
export interface DeliveryChannelCatalogue {
  readonly storeId: string;
  readonly currency: string;
  readonly mappingRevision: string;
  readonly draftRevision: string;
  readonly sourceRevision: string | null;
  readonly canPublish: boolean;
  readonly items: readonly DeliveryChannelMappingRow[];
  readonly serviceAvailability: readonly DeliveryChannelServiceHoursDay[];
  readonly serviceHoursEditable: boolean;
  readonly serviceHoursStatus: 'reviewedTemplate';
  readonly currentServiceAvailability: readonly DeliveryChannelServiceHoursDay[];
  readonly currentServiceHoursStatus: 'currentReadback' | 'lastConfirmed' | 'unknown';
  readonly blockingCodes: readonly string[];
  readonly warningCodes: readonly string[];
  readonly latestPublication: import('./deliveryChannelManagement').DeliveryChannelPublicationSummary | null;
}

export interface DeliveryChannelDraftMapping {
  readonly providerItemId: string;
  readonly productId: string;
  readonly variationId: string | null;
}

export interface DeliveryChannelCatalogueDraftRequest {
  readonly expectedDraftRevision: string | null;
  readonly items: readonly DeliveryChannelDraftMapping[];
}

export interface DeliveryChannelCatalogueDraft {
  readonly draftRevision: string;
  readonly mappingRevision: string;
  readonly updatedAt: string;
  readonly items: readonly DeliveryChannelMappingRow[];
}

export interface DeliveryChannelPreviewRequest {
  readonly draftRevision: string;
}

export interface DeliveryChannelPreview {
  readonly draftRevision: string;
  readonly mappingRevision: string;
  readonly sourceRevision: string;
  readonly publicationRevision: string;
  readonly currency: string;
  readonly canPublish: boolean;
  readonly items: readonly DeliveryChannelMappingRow[];
  readonly serviceAvailability: readonly DeliveryChannelServiceHoursDay[];
  readonly serviceHoursEditable: boolean;
  readonly serviceHoursStatus: 'reviewedTemplate';
  readonly currentServiceAvailability: readonly DeliveryChannelServiceHoursDay[];
  readonly currentServiceHoursStatus: 'currentReadback' | 'lastConfirmed' | 'unknown';
  readonly blockingCodes: readonly string[];
  readonly warningCodes: readonly string[];
}

export interface DeliveryChannelPublishRequest {
  readonly draftRevision: string;
  readonly publicationRevision: string;
}
export interface DeliveryChannelPublication {
  readonly id: string;
  readonly mappingRevision: string;
  readonly publicationRevision: string;
  readonly sourceRevision: string;
  readonly state: 'pending' | 'verified' | 'uncertain' | 'mismatch' | 'failed' | 'abandoned';
  readonly providerReadbackVerified: boolean;
  readonly providerMenuHash: string | null;
  readonly verifiedAt: string | null;
  readonly resultCode: string | null;
}

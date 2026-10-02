/** Provider connection lifecycle projected by the tenant management summary. */
export type DeliveryChannelConnectionStatus = 'notConnected' | 'authorizing' | 'connected' | 'needsAttention';
export type DeliveryChannelHealthStatus = 'unknown' | 'healthy' | 'degraded' | 'unavailable';
export type DeliveryChannelPublicationState =
  'pending' | 'uncertain' | 'verified' | 'mismatch' | 'failed' | 'abandoned';

/** Frontend mirror of backend `DeliveryChannelCapabilityDto`. */
export interface DeliveryChannelCapabilities {
  readonly supportsSimpleItems: boolean;
  readonly supportsVariations: boolean;
  readonly supportsModifiers: boolean;
  readonly supportsBundles: boolean;
  readonly supportsItemAvailability: boolean;
  readonly supportsStoreHoursEditing: boolean;
  readonly supportsAutomaticAcceptance: boolean;
}

/** Frontend mirror of backend `DeliveryChannelPublicationSummaryDto`. */
export interface DeliveryChannelPublicationSummary {
  readonly id: string;
  readonly mappingRevision: string;
  readonly publicationRevision: string;
  readonly state: DeliveryChannelPublicationState;
  readonly verifiedAt: string | null;
  readonly resultCode: string | null;
}

/** Frontend mirror of backend `DeliveryChannelManagementSummaryDto`. */
export interface DeliveryChannelManagementSummary {
  readonly provider: string;
  readonly enabled: boolean;
  readonly sandboxOnly: boolean;
  readonly connectionStatus: DeliveryChannelConnectionStatus;
  readonly healthStatus: DeliveryChannelHealthStatus;
  readonly storeId: string;
  readonly currency: string;
  readonly storeConfirmed: boolean;
  readonly storeDisplayName: string | null;
  readonly integrationEnabled: boolean;
  readonly isOrderManager: boolean;
  readonly pendingMerchantActivation: boolean;
  readonly requireManualAcceptance: boolean;
  readonly paused: boolean;
  readonly checkedAt: string | null;
  readonly degradedReason: string | null;
  readonly capabilities: DeliveryChannelCapabilities;
  readonly latestPublication: DeliveryChannelPublicationSummary | null;
}

/** Frontend mirrors of backend OAuth DTOs. */
export interface DeliveryChannelOAuthStart {
  readonly flowId: string;
  readonly authorizationUrl: string;
  readonly expiresAt: string;
}

export interface DeliveryChannelOAuthFlow {
  readonly flowId: string;
  readonly status: 'pending' | 'connected' | 'failed' | 'expired';
  readonly storeId: string;
  readonly storeConfirmed: boolean;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly completedAt: string | null;
  readonly errorCode: string | null;
}

/** Frontend mirror of backend `DeliveryChannelAvailabilityDto`. */
export interface DeliveryChannelAvailability {
  readonly enabled: boolean;
  readonly paused: boolean;
  readonly pausedUntil: string | null;
  readonly checkedAt: string;
  readonly storeStatus: string | null;
  readonly items: readonly DeliveryChannelItemAvailability[];
}

export interface DeliveryChannelItemAvailability {
  readonly providerItemId: string;
  readonly productId: string;
  readonly variationId: string | null;
  readonly desiredAvailable: boolean;
  readonly confirmedAvailable: boolean | null;
  readonly state: string;
  readonly verifiedAt: string | null;
  readonly isStale: boolean;
  readonly reasonCode: string | null;
}

export interface DeliveryChannelAvailabilityAction {
  readonly state: string;
  readonly effectiveUntil: string | null;
  readonly providerConfirmed: boolean;
  readonly resultCode: string | null;
}

export interface DeliveryChannelDisconnectResult {
  readonly status: string;
  readonly providerManagerRelinquished: boolean;
  readonly localBridgePaused: boolean;
  readonly resultCode: string | null;
  readonly completedAt: string;
}

import type { OptionSetAttachmentRole, OptionSetConflictPolicy } from './optionSet';

export type OptionSetPreviewStatus = 'ready' | 'unchanged' | 'conflict';
export type OptionSetApplyStatus = 'applied' | 'unchanged' | 'conflict';
export type OptionSetRowAction = 'add' | 'update' | 'remove' | 'preserve';

export interface OptionSetTargetSettings {
  readonly minSelection?: number | null;
  readonly maxSelection?: number | null;
  readonly includedFree?: number | null;
  readonly displayOrder?: number | null;
  /** Explicitly clears the stored maximum for sauce attachments. */
  readonly clearMaxSelection?: boolean;
}

export interface OptionSetEntryOverride {
  readonly name?: string;
  readonly displayOrder?: number;
  readonly isOptional?: boolean;
  readonly maxQuantity?: number;
  readonly price?: number;
  readonly isIncludedInBasePrice?: boolean;
  readonly isRequired?: boolean;
  readonly additionalPrice?: number;
  readonly isDefault?: boolean;
}

export interface OptionSetTargetRequest {
  readonly targetKey: string;
  readonly role: OptionSetAttachmentRole;
  readonly targetProductId: string;
  readonly targetMenuSectionId?: string;
  readonly targetCustomizationGroupId?: string;
  readonly expectedMenuAuthoringVersion?: number;
  readonly expectedCustomizationGroupVersion?: number;
  readonly expectedAttachmentVersion?: number | null;
  readonly entryIds?: readonly string[];
  readonly overrides?: Readonly<Record<string, OptionSetEntryOverride>>;
  readonly conflictPolicy: OptionSetConflictPolicy;
  readonly settings?: OptionSetTargetSettings;
  readonly intentionalDifferenceReason?: string;
}

export interface OptionSetMaterializationConflict {
  readonly code: string;
  readonly message: string;
  readonly entryId?: string;
  readonly rowId?: string;
}

export interface OptionSetMaterializationChange {
  readonly entryId: string;
  readonly rowType: string;
  readonly rowId?: string;
  readonly action: OptionSetRowAction;
  readonly changedFields: string[];
  readonly preservedFields: string[];
}

export interface OptionSetTargetPreview {
  readonly targetKey: string;
  readonly targetProductId: string;
  readonly targetMenuSectionId?: string;
  readonly status: OptionSetPreviewStatus;
  readonly attachmentId?: string;
  readonly currentAttachmentVersion?: number;
  readonly currentMenuAuthoringVersion?: number;
  readonly targetCustomizationGroupId?: string;
  readonly currentCustomizationGroupVersion?: number;
  readonly conflicts: OptionSetMaterializationConflict[];
  readonly changes: OptionSetMaterializationChange[];
  readonly currentSettings: OptionSetTargetSettings;
  readonly proposedSettings: OptionSetTargetSettings;
  readonly changedSettings: readonly string[];
}

export interface OptionSetMaterializationPreview {
  readonly optionSetId: string;
  readonly setVersion: number;
  readonly targets: OptionSetTargetPreview[];
  readonly relatedOfferWarnings: OptionSetRelatedOfferWarning[];
}

export interface OptionSetRelatedOfferWarning {
  readonly targetKey: string;
  readonly relatedProductId: string;
  readonly relatedProductName: string;
  readonly relatedOfferType: 'standalone' | 'menu';
  readonly relatedVariationId?: string | null;
  readonly relatedTargetRole: 'productChoice' | 'bundleChoice';
  readonly relatedTargetId?: string | null;
  readonly relatedTargetName?: string | null;
  readonly reasonRequired: boolean;
}

export interface OptionSetTargetResult {
  readonly targetKey: string;
  readonly status: OptionSetApplyStatus;
  readonly attachmentId?: string;
  readonly attachmentVersion?: number;
  readonly menuAuthoringVersion?: number;
  readonly customizationGroupVersion?: number;
  readonly appliedRows: Array<{ entryId: string; rowType: string; rowId: string; action: OptionSetRowAction }>;
  readonly conflicts: OptionSetMaterializationConflict[];
}

export interface OptionSetMaterializationResult {
  readonly optionSetId: string;
  readonly setVersion: number;
  readonly targets: OptionSetTargetResult[];
}

export interface OptionSetMaterializationRequest {
  readonly expectedSetVersion: number;
  readonly idempotencyKey: string;
  readonly targets: readonly OptionSetTargetRequest[];
}

import type { LanguageCode } from '@/config/languageConfig';

export const OPTION_SET_KINDS = ['ingredient', 'sauce', 'bundleChoice', 'suggestedSide'] as const;
export type OptionSetKind = (typeof OPTION_SET_KINDS)[number];
export const OPTION_SET_ATTACHMENT_ROLES = [
  'ingredient',
  'sauce',
  'bundleChoice',
  'suggestedSide',
  'productChoice',
] as const;
export type OptionSetAttachmentRole = (typeof OPTION_SET_ATTACHMENT_ROLES)[number];
export type OptionSetStatus = 'active' | 'archived';
export type OptionSetConflictPolicy = 'preserveLocal' | 'useSetValues' | 'useOverrides';

export interface OptionSetEntry {
  readonly id?: string;
  readonly name: string;
  readonly displayOrder: number;
  readonly globalIngredientId?: string;
  readonly productId?: string;
  readonly productVariationId?: string;
  readonly isOptional: boolean;
  readonly maxQuantity: number;
  readonly price: number;
  readonly isIncludedInBasePrice: boolean;
  readonly isRequired: boolean;
  readonly additionalPrice: number;
  readonly isDefault: boolean;
}

export interface OptionSetAttachment {
  readonly id: string;
  readonly role: OptionSetAttachmentRole;
  readonly targetProductId: string;
  readonly targetMenuSectionId?: string;
  readonly targetCustomizationGroupId?: string;
  readonly appliedSetVersion: number;
  readonly version: number;
  readonly minSelection?: number;
  readonly maxSelection?: number;
  readonly includedFree?: number;
  readonly displayOrder: number;
  readonly intentionalDifferenceReason?: string | null;
}

export interface OptionSetSummary {
  readonly id: string;
  readonly kind: OptionSetKind;
  readonly name: string;
  readonly status: OptionSetStatus;
  readonly version: number;
  readonly entryCount: number;
  readonly attachmentCount: number;
  readonly updatedAt?: string | null;
  readonly sourceTemplateId?: string;
  readonly sourceRevision?: number;
}

export interface OptionSetDetail extends OptionSetSummary {
  readonly sourceLocale?: LanguageCode;
  readonly translations?: Record<string, string>;
  readonly entries: OptionSetEntry[];
  readonly attachments: OptionSetAttachment[];
}

export interface OptionSetPage {
  readonly items: OptionSetSummary[];
  readonly nextCursor?: string | null;
}

export interface OptionSetWriteRequest {
  readonly kind: OptionSetKind;
  readonly name: string;
  readonly sourceLocale: LanguageCode;
  readonly translations: Record<string, string>;
  readonly status?: OptionSetStatus;
  readonly entries: OptionSetEntry[];
}

export interface OptionSetListFilters {
  readonly kind?: OptionSetKind;
  readonly query?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface OptionSetApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly message?: string;
  readonly errors?: string[];
  readonly errorCode?: string;
}

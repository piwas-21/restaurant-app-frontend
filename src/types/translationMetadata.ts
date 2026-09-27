export type TranslationSourceKind = 'tenantSource' | 'template' | 'ai' | 'manual' | 'legacyUnknown';
export type TranslationReviewStatus = 'source' | 'reviewed' | 'unknown';

export interface TranslationProvenance {
  readonly kind: TranslationSourceKind;
  readonly templateId?: string;
  readonly templateRevision?: number;
  readonly sourceHash?: string;
  readonly reviewStatus?: TranslationReviewStatus;
  readonly reviewerId?: string;
  readonly reviewedAt?: string;
}

/** Read metadata may include server-owned provenance; writes send the other two maps only. */
export interface TranslationMetadata {
  readonly sourceLocales?: Readonly<Record<string, string>>;
  readonly acceptedSuggestionIds?: Readonly<Record<string, string>>;
  readonly provenance?: Readonly<Record<string, Readonly<Record<string, TranslationProvenance>>>>;
  /** Server-issued guard for the owner's source fields and full locale content map. */
  readonly expectedContentVersion?: string;
}

export interface LocalizedOwnerMetadataInput {
  readonly sourceLocales: Readonly<Record<string, string>>;
  readonly acceptedSuggestionIds: Readonly<Record<string, string>>;
}

export interface EditorTranslationMetadataPatch {
  readonly product: LocalizedOwnerMetadataInput & { readonly expectedContentVersion?: string };
  readonly variations: Readonly<Record<number, LocalizedOwnerMetadataInput>>;
  readonly ingredients: Readonly<Record<number, LocalizedOwnerMetadataInput>>;
  readonly menuSections: Readonly<Record<number, LocalizedOwnerMetadataInput>>;
}

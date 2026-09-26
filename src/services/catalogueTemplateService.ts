import type { LanguageCode } from '@/config/languageConfig';
import { boundedCatalogueSearchPageSize } from '@/config/catalogue';
import { apiClient } from '@/utils/apiClient';
export { resolveCatalogueTemplateText } from './catalogueTemplateText';

export const CATALOGUE_TEMPLATE_TYPES = [
  'ingredient',
  'option-set',
  'item',
  'bundle',
  'category',
  'cuisine-pack',
] as const;

export type CatalogueTemplateType = (typeof CATALOGUE_TEMPLATE_TYPES)[number];

export const CATALOGUE_TYPE_LABEL_KEYS: Record<CatalogueTemplateType, string> = {
  ingredient: 'catalogue_type_ingredient',
  'option-set': 'catalogue_type_option-set',
  item: 'catalogue_type_item',
  bundle: 'catalogue_type_bundle',
  category: 'catalogue_type_category',
  'cuisine-pack': 'catalogue_type_cuisine-pack',
};

export const CATALOGUE_REVIEW_FIELD_LABEL_KEYS: Record<CatalogueReviewField, string> = {
  price: 'catalogue_review_field_price',
  ingredients: 'catalogue_review_field_ingredients',
  allergens: 'catalogue_review_field_allergens',
  availability: 'catalogue_review_field_availability',
  channels: 'catalogue_review_field_channels',
  'kitchen-routing': 'catalogue_review_field_kitchen-routing',
  images: 'catalogue_review_field_images',
};

export interface CatalogueTemplateSummary {
  templateId: string;
  revision: number;
  type: CatalogueTemplateType;
  cuisines: string[];
  displayName: string;
  sourceLocale: LanguageCode;
  displayLocale: LanguageCode;
  usedSourceFallback: boolean;
  reviewedTranslationLocales: LanguageCode[];
  dependencyCount: number;
  compatibleTenantContractVersions: number[];
}

export interface CatalogueTemplateListResponse {
  items: CatalogueTemplateSummary[];
  nextCursor: string | null;
}

export interface CatalogueTemplateReference {
  templateId: string;
  revision: number;
}

export interface CatalogueTemplateOptionReference extends CatalogueTemplateReference {
  sortOrder: number;
  default?: boolean;
}

export type CatalogueReviewField =
  'price' | 'ingredients' | 'allergens' | 'availability' | 'channels' | 'kitchen-routing' | 'images';

interface CatalogueBundlePayload {
  standaloneOffer?: CatalogueTemplateReference;
  offerFamily?: CatalogueTemplateReference;
  sections: Array<{
    sectionKey: string;
    name: string;
    sortOrder: number;
    min: number;
    max: number;
    options: CatalogueTemplateOptionReference[];
  }>;
  requiredLocalReviewFields: CatalogueReviewField[];
}

interface CatalogueItemPayload {
  category?: CatalogueTemplateReference;
  suggestedIngredients: CatalogueTemplateReference[];
  optionSets: CatalogueTemplateReference[];
  sideSets: CatalogueTemplateReference[];
  requiredLocalReviewFields: CatalogueReviewField[];
}

interface CatalogueOptionSetPayload {
  kind: 'sauce' | 'ingredient' | 'bundle-option' | 'suggested-side';
  min: number;
  max: number;
  options: CatalogueTemplateOptionReference[];
}

interface CatalogueCuisinePackPayload {
  categories: Array<CatalogueTemplateReference & { sortOrder: number }>;
  offers: Array<CatalogueTemplateReference & { sortOrder: number; includedByDefault: boolean }>;
  requiredLocalReviewFields: CatalogueReviewField[];
}

interface CatalogueIngredientPayload {
  suggestedOnly: true;
  role: string;
}

interface CatalogueCategoryPayload {
  sortOrder: number;
}

export interface CatalogueTemplateProvenance {
  contentOrigin: 'sofra-original' | 'external-licensed' | 'public-domain';
  sourceDescription: string;
  license: string;
  attribution?: string;
  evidenceRef?: string;
  mediaAssets: Array<{ assetPath: string; license: string; evidenceRef: string }>;
}

export interface CatalogueTemplateTranslation {
  name: string;
  description?: string;
}

export interface CatalogueTemplateDependency extends CatalogueTemplateReference {
  role: 'category' | 'offer' | 'ingredient' | 'option-set' | 'side-set' | 'bundle-option' | 'offer-family';
  sortOrder?: number;
  includedByDefault?: boolean;
}

interface CatalogueTemplateRevisionBase {
  schemaVersion: number;
  templateId: string;
  revision: number;
  cuisines: string[];
  name: string;
  description: string | null;
  sourceLocale: LanguageCode;
  translations: Partial<Record<LanguageCode, CatalogueTemplateTranslation>>;
  localeFallbacks: LanguageCode[];
  dependencies: CatalogueTemplateDependency[];
  provenance: CatalogueTemplateProvenance;
  qualityStatus: 'reviewed';
  compatibleTenantContractVersions: number[];
  contentHash: string;
}

export type CatalogueTemplateRevision =
  | (CatalogueTemplateRevisionBase & { type: 'ingredient'; payload: CatalogueIngredientPayload })
  | (CatalogueTemplateRevisionBase & { type: 'option-set'; payload: CatalogueOptionSetPayload })
  | (CatalogueTemplateRevisionBase & { type: 'item'; payload: CatalogueItemPayload })
  | (CatalogueTemplateRevisionBase & { type: 'bundle'; payload: CatalogueBundlePayload })
  | (CatalogueTemplateRevisionBase & { type: 'category'; payload: CatalogueCategoryPayload })
  | (CatalogueTemplateRevisionBase & { type: 'cuisine-pack'; payload: CatalogueCuisinePackPayload });

export interface CatalogueTemplateListParams {
  readonly type?: CatalogueTemplateType | '';
  readonly cuisine?: string;
  readonly q?: string;
  readonly locale: LanguageCode;
  readonly cursor?: string | null;
  readonly limit?: number;
}

export const listCatalogueTemplates = (
  params: CatalogueTemplateListParams,
  signal?: AbortSignal,
): Promise<CatalogueTemplateListResponse> => {
  const limit = boundedCatalogueSearchPageSize(params.limit);
  const query = new URLSearchParams({ locale: params.locale, limit: String(limit) });
  if (params.type) query.set('type', params.type);
  if (params.cuisine?.trim()) query.set('cuisine', params.cuisine.trim());
  if (params.q?.trim()) query.set('q', params.q.trim());
  if (params.cursor) query.set('cursor', params.cursor);
  return apiClient.get<CatalogueTemplateListResponse>(
    `/api/catalogue/templates?${query.toString()}`,
    signal ? { signal } : undefined,
  );
};

export const getCatalogueTemplateRevision = (
  templateId: string,
  revision: number,
  signal?: AbortSignal,
): Promise<CatalogueTemplateRevision> => {
  const path = `/api/catalogue/templates/${encodeURIComponent(templateId)}/revisions/${revision}`;
  return apiClient.get<CatalogueTemplateRevision>(path, signal ? { signal } : undefined);
};

/** Stable, operator-authored references that define a product or bundle's customer step order. */
export const CUSTOMER_PRODUCT_STEP_KINDS = [
  'ProductVariation',
  'ProductIngredient',
  'ProductCustomizationGroup',
  'ProductSauce',
  'ProductSuggestedSide',
] as const;

export const CUSTOMER_BUNDLE_STEP_KINDS = [
  'BundleSection',
  'BundleComponentVariation',
  'BundleComponentIngredient',
  'BundleComponentCustomizationGroup',
  'BundleComponentSauce',
  'BundleComponentSide',
] as const;

export type CustomerProductStepKind = (typeof CUSTOMER_PRODUCT_STEP_KINDS)[number];
export type CustomerBundleStepKind = (typeof CUSTOMER_BUNDLE_STEP_KINDS)[number];
export type CustomerStepKind = CustomerProductStepKind | CustomerBundleStepKind;

export type CustomerCompositionRole =
  'Menu' | 'Dish' | 'RequiredChoice' | 'Extra' | 'Sauce' | 'Side' | 'Drink' | 'Ingredient' | 'Unknown';

export type EditableCustomerCompositionRole = Exclude<CustomerCompositionRole, 'Unknown'>;

interface CustomerStepFields {
  compositionRole: CustomerCompositionRole;
  presentationOrder: number;
  presentationLabel?: string | null;
}

export type ProductCustomerStep = CustomerStepFields & {
  kind: CustomerProductStepKind;
  targetId: string;
};

export type BundleSectionCustomerStep = CustomerStepFields & {
  kind: 'BundleSection';
  targetId: string;
  parentComponentId?: string | null;
};

export type BundleComponentCustomerStep = CustomerStepFields & {
  kind: Exclude<CustomerBundleStepKind, 'BundleSection'>;
  sectionId: string;
  sectionItemId: string;
  productId: string;
  scopeId: string;
  parentComponentId?: string | null;
};

export type CustomerStepDescriptor = ProductCustomerStep | BundleSectionCustomerStep | BundleComponentCustomerStep;

export function isBundleComponentStep(step: CustomerStepDescriptor): step is BundleComponentCustomerStep {
  return (
    step.kind === 'BundleComponentVariation' ||
    step.kind === 'BundleComponentIngredient' ||
    step.kind === 'BundleComponentCustomizationGroup' ||
    step.kind === 'BundleComponentSauce' ||
    step.kind === 'BundleComponentSide'
  );
}

export function isProductCustomerStep(step: CustomerStepDescriptor): step is ProductCustomerStep {
  return (
    step.kind === 'ProductVariation' ||
    step.kind === 'ProductIngredient' ||
    step.kind === 'ProductCustomizationGroup' ||
    step.kind === 'ProductSauce' ||
    step.kind === 'ProductSuggestedSide'
  );
}

export interface CustomerStepManifest {
  schemaVersion: 1;
  /** Expected-current revision; successful writes return the incremented value. */
  revision: number;
  steps: CustomerStepDescriptor[];
}

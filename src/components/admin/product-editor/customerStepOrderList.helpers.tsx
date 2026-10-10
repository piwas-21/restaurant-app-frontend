import type { ReactNode } from 'react';
import { CupSoda, Droplets, ListOrdered, Salad, Utensils, type LucideIcon } from 'lucide-react';
import FormField from '@/components/design-system/FormField';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import type {
  BundleComponentCustomerStep,
  CustomerCompositionRole,
  CustomerStepManifest,
  CustomerStepKind,
  MenuSection,
  ProductCustomerStep,
} from '@/types/menu';
import { isBundleComponentStep, isProductCustomerStep } from '@/types/menu';
import type { CustomerStepScreen } from '@/utils/customerStepManifest';
import { changeBundleSectionParent } from '@/utils/customerStepEditor';
import { isCustomerScreenOrderValid } from '@/utils/customerStepDependencies';
import { groupCustomerStepScreens } from '@/utils/customerStepManifest';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const ICON_BY_ROLE: Partial<Record<CustomerCompositionRole, LucideIcon>> = {
  Drink: CupSoda,
  Side: Salad,
  Sauce: Droplets,
};

const ICON_BY_KIND: Partial<Record<CustomerStepKind, LucideIcon>> = {
  ProductVariation: ListOrdered,
  ProductIngredient: Utensils,
  ProductCustomizationGroup: Utensils,
  ProductSauce: Droplets,
  ProductSuggestedSide: Salad,
  BundleSection: Utensils,
  BundleComponentVariation: ListOrdered,
  BundleComponentIngredient: Utensils,
  BundleComponentCustomizationGroup: Utensils,
  BundleComponentSauce: Droplets,
  BundleComponentSide: Salad,
};

export function screenInfo(
  screen: CustomerStepScreen,
  sections: readonly MenuSection[],
  product: ProductDetails,
  t: Translate,
): { title: string; context: ReactNode } {
  const ref = screen.refs[0];
  if (ref.kind === 'BundleSection') {
    const section = sections.find((entry) => entry.id === ref.targetId);
    return {
      title: screen.presentationLabel ?? section?.name ?? t('customer_step_name_unavailable'),
      context: <bdi dir="auto">{t('customer_role_menu')}</bdi>,
    };
  }
  if (isBundleComponentStep(ref)) {
    const ownerSection = sections.find((section) => section.id === ref.sectionId);
    const item = ownerSection?.items.find((candidate) => candidate.id === ref.sectionItemId);
    return {
      title: screen.presentationLabel ?? t(stepTitleKey(ref.kind)),
      context: (
        <>
          <bdi dir="auto">{ownerSection?.name ?? t('customer_step_name_unavailable')}</bdi> ·{' '}
          <bdi dir="auto">{item?.productName ?? t('customer_step_name_unavailable')}</bdi>
        </>
      ),
    };
  }
  return {
    title: screen.presentationLabel ?? t(stepTitleKey(ref.kind)),
    context: <bdi dir="auto">{product.name}</bdi>,
  };
}

export function roleLabel(role: Exclude<CustomerCompositionRole, 'Unknown'>, t: Translate): string {
  switch (role) {
    case 'Menu':
      return t('customer_role_menu');
    case 'Dish':
      return t('customer_role_dish');
    case 'RequiredChoice':
      return t('customer_role_required_choice');
    case 'Extra':
      return t('customer_role_extra');
    case 'Sauce':
      return t('customer_role_sauce');
    case 'Side':
      return t('customer_role_side');
    case 'Drink':
      return t('customer_role_drink');
    case 'Ingredient':
      return t('customer_role_ingredient');
  }
}

export function screenIsRequired(
  screen: CustomerStepScreen,
  sections: readonly MenuSection[],
  product: ProductDetails,
): boolean {
  const ref = screen.refs[0];
  if (ref.kind === 'BundleSection') {
    const section = sections.find((entry) => entry.id === ref.targetId);
    return Boolean(section?.isRequired || (section?.minSelection ?? 0) > 0);
  }
  if (isBundleComponentStep(ref)) return isRequiredBundleComponentStep(ref, screen, sections);
  return isProductCustomerStep(ref) && isRequiredProductStep(ref, screen, product);
}

function isRequiredBundleComponentStep(
  ref: BundleComponentCustomerStep,
  screen: CustomerStepScreen,
  sections: readonly MenuSection[],
): boolean {
  const item = sections
    .find((section) => section.id === ref.sectionId)
    ?.items.find((entry) => entry.id === ref.sectionItemId);
  if (ref.kind === 'BundleComponentVariation') return Boolean(item?.hideBaseProduct && !item.productVariationId);
  if (ref.kind === 'BundleComponentSauce') return (item?.sauceMin ?? 0) > 0;
  const refs = new Set(screen.refs.flatMap((row) => (isBundleComponentStep(row) ? [row.scopeId] : [])));
  if (ref.kind === 'BundleComponentSide')
    return Boolean(item?.suggestedSideItems?.some((side) => refs.has(side.id) && side.isRequired));
  if (ref.kind !== 'BundleComponentCustomizationGroup') return false;
  return Boolean(
    item?.customizationGroups?.some((group) => refs.has(group.id) && (group.isRequired || group.minSelection > 0)),
  );
}

function isRequiredProductStep(ref: ProductCustomerStep, screen: CustomerStepScreen, product: ProductDetails): boolean {
  if (ref.kind === 'ProductVariation') return Boolean(product.hideBaseProduct);
  if (ref.kind === 'ProductSauce') return (product.sauceMin ?? 0) > 0;
  const refs = new Set(screen.refs.flatMap((row) => (isProductCustomerStep(row) ? [row.targetId] : [])));
  if (ref.kind === 'ProductSuggestedSide') {
    return Boolean(
      product.suggestedSideItems?.some(
        (side) => side.suggestedSideItemId && refs.has(side.suggestedSideItemId) && side.isRequired,
      ),
    );
  }
  if (ref.kind !== 'ProductCustomizationGroup') return false;
  return Boolean(
    product.customizationGroups?.some((group) => refs.has(group.id) && (group.isRequired || group.minSelection > 0)),
  );
}

export function StepIcon({ kind, role }: Readonly<{ kind: CustomerStepKind; role: CustomerCompositionRole }>) {
  const Icon = ICON_BY_ROLE[role] ?? ICON_BY_KIND[kind] ?? Utensils;
  return <Icon size={18} />;
}

function stepTitleKey(kind: string): string {
  const keys: Record<string, string> = {
    ProductVariation: 'select_variation',
    ProductIngredient: 'customize_ingredients',
    ProductCustomizationGroup: 'customize_ingredients',
    ProductSauce: 'sauces',
    ProductSuggestedSide: 'step_sides_accompaniments',
    BundleComponentVariation: 'select_variation',
    BundleComponentIngredient: 'customize_ingredients',
    BundleComponentCustomizationGroup: 'customize_ingredients',
    BundleComponentSauce: 'sauces',
    BundleComponentSide: 'step_sides_accompaniments',
  };
  return keys[kind] ?? 'customer_step_name_unavailable';
}

export function SectionParentField({
  screen,
  manifest,
  sections,
  disabled,
  t,
  onChange,
}: Readonly<{
  screen: CustomerStepScreen;
  manifest: CustomerStepManifest;
  sections: readonly MenuSection[];
  disabled: boolean;
  t: Translate;
  onChange: (sectionId: string, parentComponentId: string | null) => void;
}>) {
  const ref = screen.refs.find((step) => step.kind === 'BundleSection');
  if (ref?.kind !== 'BundleSection') return null;
  return (
    <FormField label={t('customer_section_belongs_to')}>
      <select
        value={ref.parentComponentId ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(ref.targetId, event.target.value || null)}
      >
        <option value="">{t('customer_section_always_available')}</option>
        {dishSections(manifest, sections).flatMap((section) =>
          section.items.map((item) => {
            const next = changeBundleSectionParent(manifest, ref.targetId, item.id, sections);
            const itemName = item.productName || t('customer_step_name_unavailable');
            return (
              <option
                key={item.id}
                value={item.id}
                disabled={!next || !isCustomerScreenOrderValid(groupCustomerStepScreens(next), sections)}
              >
                {section.name} · {itemName}
              </option>
            );
          }),
        )}
      </select>
    </FormField>
  );
}

function dishSections(manifest: CustomerStepManifest, sections: readonly MenuSection[]): MenuSection[] {
  const dishSectionIds = new Set(
    manifest.steps.flatMap((step) =>
      step.kind === 'BundleSection' && step.compositionRole === 'Dish' ? [step.targetId] : [],
    ),
  );
  return sections.filter((section) => dishSectionIds.has(section.id));
}

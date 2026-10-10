import { fireEvent, render, screen } from '@testing-library/react';
import type { CustomerStepManifest, DetailedProduct, DetailedProductVariation, MenuSection } from '@/types/menu';
import { buildCustomerProductSteps, buildMixedBundleSteps } from '@/utils/customerStepPlanner';
import CustomerFlowPhonePreview from './CustomerFlowPhonePreview';
import VariationsSection from '@/components/menu/customization/VariationsSection';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      if (key === 'customer_preview_step_count') return `Step ${values?.current} of ${values?.total}`;
      if (key === 'customer_cta_next_step') return `Next: ${values?.step}`;
      if (key === 'customer_preview_read_only_action') return `Preview only: ${values?.action}`;
      return key;
    },
  }),
}));

const locales = [
  ['ar', 'عادي'],
  ['fr', 'Régulier'],
] as const;

function variation(): DetailedProductVariation {
  return {
    id: 'regular',
    name: 'Regular',
    description: 'Standard size',
    priceModifier: 0,
    finalPrice: 12,
    isActive: true,
    displayOrder: 0,
    content: {
      en: { name: 'Regular' },
      ar: { name: 'عادي' },
      fr: { name: 'Régulier' },
    },
  };
}

function product(): DetailedProduct {
  return {
    id: 'taco',
    name: 'Taco',
    basePrice: 12,
    isActive: true,
    isAvailable: true,
    isSpecial: false,
    type: 'mainItem',
    ingredients: [],
    allergens: [],
    displayOrder: 0,
    content: {},
    images: [],
    categories: [],
    variations: [variation()],
    detailedIngredients: [],
    suggestedSideItems: [],
    hideBaseProduct: true,
  };
}

function guestVariation(variationRow: DetailedProductVariation, language: string) {
  return (
    <VariationsSection
      variations={[variationRow]}
      selectedVariationId={null}
      onVariationChange={jest.fn()}
      basePrice={12}
      currentLanguage={language}
      productName="Taco"
      hideBaseProduct
    />
  );
}

function variationManifest(targetId: string): CustomerStepManifest {
  return {
    schemaVersion: 1,
    revision: 1,
    steps: [{ kind: 'ProductVariation', targetId, compositionRole: 'RequiredChoice', presentationOrder: 0 }],
  };
}

describe.each(locales)('CustomerFlowPhonePreview localized content in %s', (language, translatedName) => {
  it('matches the guest product variation label', () => {
    const item = product();
    const manifest = variationManifest('regular');
    render(
      <>
        <CustomerFlowPhonePreview
          steps={buildCustomerProductSteps(item, false, manifest)}
          price={12}
          itemName="Taco"
          isBundle={false}
          product={item}
          currentLanguage={language}
        />
        {guestVariation(item.variations[0], language)}
      </>,
    );

    expect(screen.getAllByText(translatedName)).toHaveLength(2);
    expect(screen.queryByText('Regular')).not.toBeInTheDocument();
  });

  it('matches the guest component variation label', () => {
    const rowVariation = variation();
    const section: MenuSection = {
      id: 'dishes',
      name: 'Dish',
      displayOrder: 0,
      isRequired: true,
      minSelection: 1,
      maxSelection: 1,
      items: [
        {
          id: 'dish-row',
          productId: 'taco',
          productName: 'Taco',
          additionalPrice: 0,
          displayOrder: 0,
          isDefault: true,
          hideBaseProduct: true,
          variations: [rowVariation],
        },
      ],
    };
    const manifest: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 1,
      steps: [
        { kind: 'BundleSection', targetId: 'dishes', compositionRole: 'Dish', presentationOrder: 0 },
        {
          kind: 'BundleComponentVariation',
          sectionId: 'dishes',
          sectionItemId: 'dish-row',
          productId: 'taco',
          scopeId: 'regular',
          compositionRole: 'RequiredChoice',
          presentationOrder: 1,
        },
      ],
    };
    const steps = buildMixedBundleSteps([section], manifest, [
      { sectionId: 'dishes', itemId: 'taco', menuSectionItemId: 'dish-row', quantity: 1 },
    ]);

    render(
      <>
        <CustomerFlowPhonePreview steps={steps} price={12} itemName="Lunch menu" isBundle currentLanguage={language} />
        {guestVariation(rowVariation, language)}
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'customer_preview_next' }));

    expect(screen.getAllByText(translatedName)).toHaveLength(2);
    expect(screen.queryByText('Regular')).not.toBeInTheDocument();
  });
});

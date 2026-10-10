import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CustomerStepManifest, DetailedProduct } from '@/types/menu';
import type { CustomizationStep } from '@/utils/customizationSteps';
import { buildCustomerProductSteps, buildMixedBundleSteps } from '@/utils/customerStepPlanner';
import { localizedMenuSection } from '@/utils/localizedContent';
import CustomerFlowPhonePreview from './CustomerFlowPhonePreview';

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

const steps: CustomizationStep[] = [
  {
    id: 'dish',
    kind: 'section',
    title: 'Tacos',
    singleChoice: true,
    isRequired: true,
    section: {
      id: 'dish',
      name: 'Tacos',
      displayOrder: 0,
      isRequired: true,
      minSelection: 1,
      maxSelection: 1,
      items: [
        {
          id: 'dish-row',
          productId: 'dish-product',
          productName: 'Taco',
          displayOrder: 0,
          additionalPrice: 0,
          isDefault: true,
        },
      ],
    },
  },
  {
    id: 'extra',
    kind: 'ingredients',
    titleKey: 'customize_ingredients',
    singleChoice: false,
    isRequired: false,
    ingredientIds: ['onion'],
    component: {
      id: 'dish-row',
      productId: 'dish-product',
      productName: 'Taco',
      additionalPrice: 0,
      displayOrder: 0,
      isDefault: true,
    },
  },
  { id: 'review', kind: 'review', titleKey: 'step_review_menu', singleChoice: false, isRequired: false },
];

function variationProduct(ids: string[]): DetailedProduct {
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
    variations: ids.map((id, index) => ({
      id,
      name: id,
      priceModifier: 0,
      finalPrice: 12,
      isActive: true,
      displayOrder: index,
    })),
    detailedIngredients: [
      {
        id: 'salsa',
        name: 'Salsa',
        kind: 'sauce',
        isOptional: true,
        price: 0,
        isActive: true,
        isIncludedInBasePrice: false,
        maxQuantity: 1,
        displayOrder: 0,
      },
    ],
    suggestedSideItems: [],
    hideBaseProduct: true,
  };
}

describe('CustomerFlowPhonePreview', () => {
  it('derives the status clock from the client time and preview locale', async () => {
    const { container } = render(
      <CustomerFlowPhonePreview steps={steps} price={12} itemName="Lunch menu" isBundle currentLanguage="en" />,
    );
    const time = await waitFor(() => {
      const element = container.querySelector('time');
      expect(element).not.toBeNull();
      return element;
    });

    if (!time) throw new Error('Expected the phone preview to render its status clock');
    const timestamp = new Date(time.dateTime);
    expect(timestamp.toString()).not.toBe('Invalid Date');
    expect(time.textContent).toBe(
      new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(timestamp),
    );
  });

  it('navigates the planned screens, updates the guest CTA, and keeps the final basket action read-only', () => {
    render(<CustomerFlowPhonePreview steps={steps} price={12} itemName="Lunch menu" isBundle currentLanguage="en" />);

    expect(screen.getByRole('heading', { name: 'Tacos' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview only: Next: customize_ingredients' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'customer_preview_next' }));

    expect(screen.getByRole('heading', { name: 'customize_ingredients' })).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview only: customer_cta_review_menu' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'customer_preview_next' }));

    expect(screen.getByRole('heading', { name: 'step_review_menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview only: customer_cta_add_to_basket' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'customer_preview_next' })).toBeDisabled();
  });

  it('keeps the active stable step after a reorder and clamps to the first step when removed', () => {
    const view = render(
      <CustomerFlowPhonePreview steps={steps} price={12} itemName="Lunch menu" isBundle currentLanguage="en" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'customer_preview_next' }));
    view.rerender(
      <CustomerFlowPhonePreview
        steps={[steps[1], steps[0], steps[2]]}
        price={12}
        itemName="Lunch menu"
        isBundle
        currentLanguage="en"
      />,
    );

    expect(screen.getByRole('heading', { name: 'customize_ingredients' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    view.rerender(
      <CustomerFlowPhonePreview
        steps={[steps[0], steps[2]]}
        price={12}
        itemName="Lunch menu"
        isBundle
        currentLanguage="en"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Tacos' })).toBeInTheDocument();
  });

  it('keeps preview navigation stable when a new variation joins a partial manifest screen', () => {
    const manifest: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 2,
      steps: [
        { kind: 'ProductVariation', targetId: 'regular', compositionRole: 'RequiredChoice', presentationOrder: 0 },
      ],
    };
    const beforeProduct = variationProduct(['regular']);
    const afterProduct = variationProduct(['regular', 'large']);
    const beforeSteps = buildCustomerProductSteps(beforeProduct, false, manifest);
    const afterSteps = buildCustomerProductSteps(afterProduct, false, manifest);
    const view = render(
      <CustomerFlowPhonePreview
        steps={beforeSteps}
        price={12}
        itemName="Taco"
        isBundle={false}
        product={beforeProduct}
        currentLanguage="en"
      />,
    );

    expect(screen.getByRole('heading', { name: 'select_variation' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'customer_preview_next' }));
    expect(screen.getByRole('heading', { name: 'sauces' })).toBeInTheDocument();
    view.rerender(
      <CustomerFlowPhonePreview
        steps={afterSteps}
        price={12}
        itemName="Taco"
        isBundle={false}
        product={afterProduct}
        currentLanguage="en"
      />,
    );

    expect(screen.getByRole('heading', { name: 'sauces' })).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(afterSteps[0].id).toBe(beforeSteps[0].id);
    fireEvent.click(screen.getByRole('button', { name: 'customer_preview_previous' }));
    expect(screen.getByText('large')).toBeInTheDocument();
  });

  it.each([
    ['fr', 'Choisissez un plat', 'Choisissez votre plat'],
    ['en', 'Choose a dish', 'Choose one dish'],
    ['ar', 'اختر طبقًا', 'اختر طبقًا واحدًا'],
  ])(
    'uses the same %s section translation in the planned screen and Next CTA',
    (language, translatedName, translatedDescription) => {
      const section = localizedMenuSection(
        {
          id: 'section-id',
          name: 'Choose a dish',
          displayOrder: 0,
          isRequired: true,
          minSelection: 1,
          maxSelection: 1,
          items: [],
          translations: {
            en: { name: 'Choose a dish', description: 'Choose one dish' },
            fr: { name: 'Choisissez un plat', description: 'Choisissez votre plat' },
            ar: { name: 'اختر طبقًا', description: 'اختر طبقًا واحدًا' },
          },
        },
        language,
      );
      const planned = buildMixedBundleSteps([section], null, [])[0];
      const previewSteps: CustomizationStep[] = [
        { id: 'before', kind: 'ingredients', title: 'Before', singleChoice: false, isRequired: false },
        planned,
      ];
      render(
        <CustomerFlowPhonePreview
          steps={previewSteps}
          price={12}
          itemName="Menu"
          isBundle
          currentLanguage={language}
        />,
      );

      expect(screen.getByRole('button', { name: `Preview only: Next: ${translatedName}` })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'customer_preview_next' }));
      expect(screen.getByRole('heading', { name: translatedName })).toBeInTheDocument();
      expect(screen.getByText(translatedDescription)).toBeInTheDocument();
    },
  );
});

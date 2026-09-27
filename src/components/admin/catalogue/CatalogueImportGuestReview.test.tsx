import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DetailedProduct } from '@/types/menu';
import type { CatalogueImportResult } from '@/services/catalogueImportService';
import { getProductById } from '@/services/menuService';
import { quoteProduct } from '@/services/productQuoteService';
import CatalogueImportGuestReview from './CatalogueImportGuestReview';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => (values ? `${key}:${Object.values(values).join(',')}` : key),
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

jest.mock('@/services/menuService', () => ({ getProductById: jest.fn() }));
jest.mock('@/services/productQuoteService', () => ({ quoteProduct: jest.fn() }));

const mockGetProductById = jest.mocked(getProductById);
const mockQuoteProduct = jest.mocked(quoteProduct);

const importedItem: CatalogueImportResult['items'][number] = {
  templateId: 'starter-item',
  revision: 2,
  status: 'Imported',
  localEntityType: 'Product',
  localEntityId: 'local-product',
  failureCode: null,
};

function product(overrides: Partial<DetailedProduct> = {}): DetailedProduct {
  return {
    id: 'local-product',
    name: 'Falafel plate',
    description: 'A local description',
    basePrice: 12,
    isActive: false,
    isAvailable: false,
    isSpecial: false,
    type: 'mainItem',
    ingredients: [],
    allergens: [],
    displayOrder: 0,
    content: {},
    images: [],
    categories: [],
    variations: [],
    suggestedSideItems: [],
    availability: { canOrder: false, reason: 'Unavailable', allowedOrderTypes: [] },
    ...overrides,
  };
}

function showGuestReview(detail: DetailedProduct) {
  mockGetProductById.mockResolvedValue({ success: true, data: detail } as never);
  return render(<CatalogueImportGuestReview items={[importedItem]} />);
}

describe('CatalogueImportGuestReview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows saved bundle choices and keeps inactive imports out of quote/orderable claims', async () => {
    const bundle = product({
      type: 'menu',
      menuDefinition: {
        id: 'menu-definition',
        isAlwaysAvailable: true,
        availableMonday: true,
        availableTuesday: true,
        availableWednesday: true,
        availableThursday: true,
        availableFriday: true,
        availableSaturday: true,
        availableSunday: true,
        sections: [
          {
            id: 'main-step',
            name: 'Choose a main',
            displayOrder: 1,
            isRequired: true,
            minSelection: 1,
            maxSelection: 1,
            items: [
              {
                id: 'main-choice',
                productId: 'main-product',
                productName: 'Falafel',
                additionalPrice: 0,
                displayOrder: 1,
                isDefault: true,
              },
            ],
          },
        ],
      },
    });
    showGuestReview(bundle);

    expect(await screen.findByText('Choose a main')).toBeInTheDocument();
    expect(screen.getByText('Falafel')).toBeInTheDocument();
    expect(screen.getByText('bundle_quote_requires_available_menu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'bundle_quote_request' })).toBeDisabled();
    expect(mockQuoteProduct).not.toHaveBeenCalled();
  });

  it('labels an inactive imported item as unavailable and does not request a quote', async () => {
    showGuestReview(product());

    expect(await screen.findByText('catalogue_import_guest_not_orderable')).toBeInTheDocument();
    expect(screen.getByText('inactive')).toBeInTheDocument();
    expect(screen.getByText('unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'bundle_quote_request' })).toBeDisabled();
    expect(screen.getByText('catalogue_import_guest_quote_not_ready')).toBeInTheDocument();
    expect(mockQuoteProduct).not.toHaveBeenCalled();
  });

  it('quotes the exact saved item defaults and displays only the server total', async () => {
    mockQuoteProduct.mockResolvedValue({
      productId: 'local-product',
      quantity: 1,
      unitPrice: 13.25,
      totalPrice: 13.25,
    });
    showGuestReview(
      product({
        isActive: true,
        isAvailable: true,
        availability: { canOrder: true, reason: 'Available', allowedOrderTypes: [] },
      }),
    );

    const quoteButton = await screen.findByRole('button', { name: 'bundle_quote_request' });
    expect(quoteButton).toBeEnabled();
    fireEvent.click(quoteButton);

    await waitFor(() =>
      expect(mockQuoteProduct).toHaveBeenCalledWith(
        'local-product',
        {
          quantity: 1,
          selectedIngredients: [],
          ingredientQuantities: {},
          customizationSelections: [],
          selectedSideItems: [],
        },
        undefined,
      ),
    );
    expect(await screen.findByText(/bundle_quote_total/)).toBeInTheDocument();
  });

  it('withholds an item quote when saved defaults miss a required guest choice', async () => {
    showGuestReview(
      product({
        isActive: true,
        isAvailable: true,
        availability: { canOrder: true, reason: 'Available', allowedOrderTypes: [] },
        customizationGroups: [
          {
            id: 'required-group',
            name: 'Choose a drink',
            displayOrder: 0,
            isRequired: true,
            minSelection: 1,
            maxSelection: 1,
            includedFreeUnits: 0,
            isActive: true,
            content: {},
            ingredientOptions: [],
            productOptions: [],
          },
        ],
      }),
    );

    expect(await screen.findByText('Choose a drink')).toBeInTheDocument();
    expect(screen.getAllByText('bundle_quote_defaults_incomplete')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'bundle_quote_request' })).toBeDisabled();
    expect(mockQuoteProduct).not.toHaveBeenCalled();
  });
});

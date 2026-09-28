import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { OrderType } from '@/types/order';
import type { Product } from '@/app/admin/menu-management/interfaces';
import type { MenuDefinition } from '@/types/menu';
import type { useProductEditorForm } from '@/hooks/admin/useProductEditorForm';
import type { useEditorTranslationReview } from '@/hooks/admin/useEditorTranslationReview';
import { getAllProducts } from '@/services/menuService';
import EditorPreSaveReview from './EditorPreSaveReview';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => (values ? `${key}:${Object.values(values).join(',')}` : key),
  }),
}));

jest.mock('@/services/menuService', () => ({ getAllProducts: jest.fn() }));
jest.mock('./translations/TranslationSuggestionsReview', () => ({ __esModule: true, default: () => null }));

const mockedGetAllProducts = jest.mocked(getAllProducts);

const allChannels = [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery];
const menuDefinition: MenuDefinition = {
  id: 'bundle-menu',
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
      id: 'drinks',
      name: 'Drinks',
      displayOrder: 1,
      isRequired: true,
      minSelection: 2,
      maxSelection: 3,
      items: ['a', 'b', 'c'].map((productId, displayOrder) => ({
        id: productId,
        productId,
        productName: productId,
        additionalPrice: 0,
        displayOrder,
        isDefault: false,
        // This is the detail payload from before the channel restriction changed. The review must
        // display the fresh summary read used by its warning, not these copied values.
        availability: {
          canOrder: true,
          reason: 'Available',
          allowedOrderTypes: allChannels,
          inheritsOrderTypes: false,
        },
      })),
    },
  ],
};

function summaryProduct(id: string, allowedOrderTypes: readonly OrderType[]): Product {
  return {
    id,
    name: id,
    description: '',
    basePrice: 0,
    isActive: true,
    isAvailable: true,
    type: 'mainItem',
    imageUrl: null,
    images: [],
    availability: { canOrder: true, reason: 'Available', allowedOrderTypes: [...allowedOrderTypes] },
  };
}

function renderReview({
  availableOrderTypes = null,
  parentProductId = 'bundle-1',
  primaryCategoryId = 'unrestricted',
  categories = [{ id: 'unrestricted', name: 'Unrestricted', availableOrderTypes: null }],
}: {
  availableOrderTypes?: number | null;
  parentProductId?: string;
  primaryCategoryId?: string;
  categories?: { id: string; name: string; availableOrderTypes: number | null }[];
} = {}) {
  const getValues = (field: string): unknown =>
    ({
      name: 'Bundle',
      basePrice: 12,
      isComponent: false,
      allergens: ['milk'],
      content: [{ language: 'en', name: 'Bundle' }],
      variations: [],
      isActive: true,
      availableOrderTypes,
      id: parentProductId,
    })[field];
  const editor = {
    form: { getValues },
    categories,
    primaryCategoryId,
    detailedIngredients: [],
    menuDefinition,
    customizationGroups: [],
  } as unknown as ReturnType<typeof useProductEditorForm>;
  const translationReview = {
    reviewWriteError: false,
    submitDecisions: jest.fn().mockResolvedValue(true),
  } as unknown as ReturnType<typeof useEditorTranslationReview>;

  return render(
    <EditorPreSaveReview
      isOpen
      onClose={jest.fn()}
      onConfirm={jest.fn()}
      isPending={false}
      isBundle
      editor={editor}
      translationReview={translationReview}
    />,
  );
}

describe('EditorPreSaveReview bundle option availability', () => {
  beforeEach(() => {
    mockedGetAllProducts.mockReset();
    mockedGetAllProducts.mockResolvedValue([
      summaryProduct('bundle-1', allChannels),
      summaryProduct('a', allChannels),
      summaryProduct('b', [OrderType.DineIn, OrderType.Takeaway]),
      summaryProduct('c', [OrderType.Takeaway]),
    ]);
  });

  it('uses a fresh child snapshot for both the shortage warning and guest-step preview', async () => {
    renderReview();

    const shortage = 'editor_review_bundle_availability_shortage:Drinks,2,order_type_delivery,1';
    const previewCount = 'bundle_preview_channel_required_choices:order_type_delivery,1,2';
    expect(await screen.findByText(shortage)).toBeInTheDocument();
    const preview = screen.getByRole('region', { name: 'bundle_guest_preview' });
    expect(within(preview).getByText(previewCount)).toBeInTheDocument();
    expect(within(preview).getByText(previewCount).closest('li')).toHaveClass('channelWarning');
    const currentOption = within(preview).getByText('c').closest('li');
    expect(
      within(currentOption as HTMLElement).getByText('bundle_preview_available_channels:order_type_takeaway'),
    ).toBeInTheDocument();
    expect(mockedGetAllProducts).toHaveBeenCalledTimes(1);
  });

  it('checks a new bundle only on the selected primary category channels', async () => {
    renderReview({
      parentProductId: '',
      primaryCategoryId: 'takeaway',
      categories: [{ id: 'takeaway', name: 'Takeaway', availableOrderTypes: 2 }],
    });

    expect(await screen.findByText('editor_review_bundle_availability_checked')).toBeInTheDocument();
    expect(
      screen.queryByText('editor_review_bundle_availability_shortage:Drinks,2,order_type_delivery,1'),
    ).not.toBeInTheDocument();
  });

  it('keeps saving blocked until the current availability check completes and exposes fetch failures', async () => {
    let rejectRead: ((reason?: unknown) => void) | undefined;
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockedGetAllProducts.mockReset();
    mockedGetAllProducts
      .mockReturnValueOnce(
        new Promise<Product[]>((_resolve, reject) => {
          rejectRead = reject;
        }),
      )
      .mockResolvedValueOnce([
        summaryProduct('bundle-1', allChannels),
        summaryProduct('a', allChannels),
        summaryProduct('b', [OrderType.DineIn, OrderType.Takeaway]),
        summaryProduct('c', [OrderType.Takeaway]),
      ]);
    renderReview();

    const saveButton = screen.getByTestId('editor-review-confirm-save');
    expect(saveButton).toBeDisabled();
    expect(screen.getByText('editor_review_bundle_availability_checking')).toBeInTheDocument();
    rejectRead?.(new Error('catalogue unavailable'));

    expect(await screen.findByRole('alert')).toHaveTextContent('editor_review_bundle_availability_check_failed');
    expect(
      screen.queryByText(
        'bundle_preview_available_channels:order_type_dine_in,order_type_takeaway,order_type_delivery',
      ),
    ).not.toBeInTheDocument();
    expect(saveButton).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'editor_review_bundle_availability_check_retry' }));
    await waitFor(() => expect(mockedGetAllProducts).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('editor_review_bundle_availability_checked')).toBeInTheDocument());
    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});

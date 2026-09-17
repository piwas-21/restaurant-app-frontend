import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import ProductEditorRoutePage from './page';
import { deleteProduct } from '@/services/productService';
import { deleteMenuBundle } from '@/services/menuBundleService';
import { useProductEditorFetch } from '@/hooks/admin/useProductEditorFetch';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';

const mockPush = jest.fn();
const mockDeleteProduct = deleteProduct as jest.MockedFunction<typeof deleteProduct>;
const mockDeleteMenuBundle = deleteMenuBundle as jest.MockedFunction<typeof deleteMenuBundle>;
const mockUseProductEditorFetch = useProductEditorFetch as jest.MockedFunction<typeof useProductEditorFetch>;

jest.mock('next/navigation', () => ({
  useParams: () => ({ productId: 'product-1' }),
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/productService');
jest.mock('@/services/menuBundleService');
jest.mock('@/hooks/admin/useProductEditorFetch');
jest.mock('@/components/admin/AdminAuthGuard', () => ({
  AdminAuthGuard: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/admin/product-editor/ProductEditorPage', () => {
  function MockProductEditorPage({ onDelete }: { onDelete: () => void }) {
    return <button onClick={onDelete}>delete</button>;
  }
  return MockProductEditorPage;
});
jest.mock('@/components/common/ConfirmationModal', () => {
  function MockConfirmationModal({ isOpen, onConfirm }: { isOpen: boolean; onConfirm: () => void }) {
    return isOpen ? <button onClick={onConfirm}>confirm</button> : null;
  }
  return MockConfirmationModal;
});
jest.mock('@/components/common/ResultModal', () => () => null);

const product: ProductDetails = {
  id: 'product-1',
  name: 'Dish',
  description: '',
  basePrice: 10,
  isActive: true,
  isAvailable: true,
  preparationTimeMinutes: 0,
  type: 'mainItem',
  ingredients: [],
  allergens: [],
  categories: [],
  variations: [],
  images: [],
  suggestedSideItems: [],
};

describe('menu-management/[productId] delete lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseProductEditorFetch.mockReturnValue({ product, isLoading: false, error: null, refetch: jest.fn() });
    mockDeleteProduct.mockResolvedValue({ success: true } as never);
    mockDeleteMenuBundle.mockResolvedValue({ success: true } as never);
  });

  it('does not complete a delete into state or navigation after the route unmounts', async () => {
    let resolveDelete!: (response: { success: boolean }) => void;
    mockDeleteProduct.mockReturnValue(
      new Promise((resolve) => {
        resolveDelete = resolve;
      }) as never,
    );
    const { getByRole, unmount } = render(<ProductEditorRoutePage />);

    fireEvent.click(getByRole('button', { name: 'delete' }));
    fireEvent.click(getByRole('button', { name: 'confirm' }));
    unmount();

    await act(async () => {
      resolveDelete({ success: true });
      await Promise.resolve();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});

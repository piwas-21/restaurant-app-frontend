import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EditCategoryModal from './EditCategoryModal';
import { updateCategory } from '@/services/categoryService';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
jest.mock('@/services/categoryService', () => ({
  updateCategory: jest.fn(async () => ({ success: true })),
  uploadCategoryImage: jest.fn(async () => ({ success: true })),
  reorderCategory: jest.fn(async () => ({ success: true })),
}));

const mockUpdateCategory = updateCategory as jest.Mock;

// 6 = takeaway|delivery, the restriction the client asked for on Dürüm.
const category: {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  displayOrder: number;
  availableOrderTypes?: number | null;
} = {
  id: 'c1',
  name: 'Dürüm Wraps',
  description: 'Wraps',
  isActive: true,
  displayOrder: 0,
  availableOrderTypes: 6,
};

const renderModal = (overrides: Partial<typeof category> = {}) =>
  render(
    <EditCategoryModal
      isOpen
      onClose={jest.fn()}
      onCategoryUpdated={jest.fn()}
      category={{ ...category, ...overrides }}
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateCategory.mockResolvedValue({ success: true });
});

describe('EditCategoryModal — order-type availability', () => {
  it('reports the effective order types read-only, with a link to the one surface that writes them', () => {
    renderModal();

    expect(screen.getByText('Takeaway, Delivery')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage' })).toHaveAttribute(
      'href',
      '/admin/restaurant-settings?tab=order-types',
    );
    // Read-only: no checkbox or select for the channels themselves.
    expect(screen.queryByLabelText('Takeaway')).not.toBeInTheDocument();
  });

  it('shows every order type for an unrestricted category', () => {
    renderModal({ availableOrderTypes: null });

    expect(screen.getByText('Dine In, Takeaway, Delivery')).toBeInTheDocument();
  });

  // The §9.1 landmine: UpdateCategoryCommand is a full-replace PUT that assigns
  // AvailableOrderTypes unconditionally, so omitting it cleared the restriction on every rename.
  it('echoes the mask back on save so an unrelated rename cannot clear the restriction', async () => {
    renderModal();

    fireEvent.change(screen.getByLabelText('category_name'), { target: { value: 'Dürüm' } });
    fireEvent.click(screen.getByRole('button', { name: 'save_changes' }));

    await waitFor(() => expect(mockUpdateCategory).toHaveBeenCalledTimes(1));
    expect(mockUpdateCategory).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ name: 'Dürüm', availableOrderTypes: 6 }),
    );
  });

  it('sends null for an unrestricted category rather than dropping the field', async () => {
    renderModal({ availableOrderTypes: undefined });

    fireEvent.click(screen.getByRole('button', { name: 'save_changes' }));

    await waitFor(() => expect(mockUpdateCategory).toHaveBeenCalledTimes(1));
    expect(mockUpdateCategory).toHaveBeenCalledWith('c1', expect.objectContaining({ availableOrderTypes: null }));
  });
});

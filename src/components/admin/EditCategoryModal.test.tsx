import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EditCategoryModal from './EditCategoryModal';
import { updateCategory, uploadCategoryImage, reorderCategory } from '@/services/categoryService';
import { ApiError } from '@/utils/apiClient';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Interpolates `{{name}}` placeholders, because the real `t` does. A mock that returned the
    // raw template would make "did the server's reason reach the sentence?" unassertable — the
    // assertion would be about the template, which is true whatever the code passed in.
    t: (key: string, fallback?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
      const opts = (typeof fallback === 'object' ? fallback : options) ?? {};
      const template = typeof fallback === 'string' ? fallback : key;
      return Object.entries(opts).reduce((text, [name, value]) => text.replace(`{{${name}}}`, String(value)), template);
    },
  }),
}));
jest.mock('@/services/categoryService', () => ({
  updateCategory: jest.fn(async () => ({ success: true })),
  uploadCategoryImage: jest.fn(async () => ({ success: true })),
  reorderCategory: jest.fn(async () => ({ success: true })),
}));

const mockUpdateCategory = updateCategory as jest.Mock;
const mockUploadCategoryImage = uploadCategoryImage as jest.Mock;
const mockReorderCategory = reorderCategory as jest.Mock;

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

const renderModal = (overrides: Partial<typeof category> = {}, onPartialSuccess = jest.fn()) => {
  const onClose = jest.fn();
  const result = render(
    <EditCategoryModal
      isOpen
      onClose={onClose}
      onCategoryUpdated={jest.fn()}
      category={{ ...category, ...overrides }}
      onPartialSuccess={onPartialSuccess}
    />,
  );
  return { ...result, onClose, onPartialSuccess };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateCategory.mockResolvedValue({ success: true });
  mockUploadCategoryImage.mockResolvedValue({ success: true });
  mockReorderCategory.mockResolvedValue({ success: true });
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

describe('EditCategoryModal — a half-saved category must reach a surface that survives the close', () => {
  it('hands the reorder reason to the page instead of a root error that unmounts', async () => {
    // The modal returns null on `!isOpen` and this path ends in `onClose()`, so a `setError('root')`
    // here is written into a slot the parent unmounts in the same batch — measured as never
    // painting. `onPartialSuccess` is the page's ResultModal, which outlives this component.
    mockReorderCategory.mockResolvedValue({
      success: false,
      message: 'Operation failed',
      errors: ['Duplicate display orders found: 3'],
    });

    const { onPartialSuccess, onClose } = renderModal();
    fireEvent.change(screen.getByLabelText('display_order'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'save_changes' }));

    await waitFor(() => expect(onPartialSuccess).toHaveBeenCalledTimes(1));
    // errors[0], not the "Operation failed" wrapper.
    expect(onPartialSuccess.mock.calls[0][0]).toContain('Duplicate display orders found: 3');
    expect(onPartialSuccess.mock.calls[0][0]).not.toContain('Operation failed');
    expect(onClose).toHaveBeenCalled();
  });

  it('reports BOTH failed steps from one save rather than only the last', async () => {
    mockReorderCategory.mockResolvedValue({ success: false, errors: ['Duplicate display orders found: 3'] });
    mockUploadCategoryImage.mockResolvedValue({ success: false, errors: ['Invalid image MIME type'] });

    const { onPartialSuccess } = renderModal();
    fireEvent.change(screen.getByLabelText('display_order'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('category_image_edit'), {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'save_changes' }));

    await waitFor(() => expect(onPartialSuccess).toHaveBeenCalledTimes(1));
    expect(onPartialSuccess.mock.calls[0][0]).toContain('Duplicate display orders found: 3');
    expect(onPartialSuccess.mock.calls[0][0]).toContain('Invalid image MIME type');
  });

  it('stays silent when every step succeeded', async () => {
    const { onPartialSuccess } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'save_changes' }));

    await waitFor(() => expect(mockUpdateCategory).toHaveBeenCalledTimes(1));
    expect(onPartialSuccess).not.toHaveBeenCalled();
  });
});

describe('EditCategoryModal — a failed update must not close or refresh', () => {
  // The extraction moved the close decision from a bare `return` (structurally impossible to get
  // wrong) to a boolean crossing a module boundary. If `useEditCategorySave.save` ever returns
  // `true` on a failed update, the modal closes and the list refreshes on a category that was
  // never written — a plain success for a failed save, the exact defect this PR removes.
  it('keeps the modal open and routes the reason to the name field on a resolved refusal', async () => {
    mockUpdateCategory.mockResolvedValue({
      success: false,
      message: 'Operation failed',
      errors: ['Another category with this name already exists'],
    });

    const { onPartialSuccess, onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'save_changes' }));

    await waitFor(() => expect(screen.getByText('Another category with this name already exists')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    expect(onPartialSuccess).not.toHaveBeenCalled();
    // A refused update must not run the steps that follow it.
    expect(mockReorderCategory).not.toHaveBeenCalled();
    expect(mockUploadCategoryImage).not.toHaveBeenCalled();
  });

  it('keeps the modal open when the update THROWS', async () => {
    mockUpdateCategory.mockRejectedValue(new ApiError(400, 'Operation failed', ['Name is required']));

    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'save_changes' }));

    await waitFor(() => expect(screen.getByText('Name is required')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not reorder when the display order is unchanged', async () => {
    const { onClose } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'save_changes' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockReorderCategory).not.toHaveBeenCalled();
  });
});

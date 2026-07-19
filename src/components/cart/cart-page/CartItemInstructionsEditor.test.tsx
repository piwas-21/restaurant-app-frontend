import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CartItem } from '@/components/cart/cartTypes';
import CartItemInstructionsEditor from './CartItemInstructionsEditor';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

type Props = React.ComponentProps<typeof CartItemInstructionsEditor>;

function renderEditor(props: Partial<Props> = {}) {
  const defaults: Props = {
    // A CUSTOMIZED item — prod dishes carry ingredient recipes; this is the case
    // the old gate hid the button for.
    item: { quantity: 2, selectedIngredientNames: ['Cheese'] } as unknown as CartItem,
    itemId: 'bi-1',
    isSyncing: false,
    editingInstructions: null,
    setEditingInstructions: jest.fn(),
    instructionsValue: '',
    setInstructionsValue: jest.fn(),
    onSaveInstructions: jest.fn(),
  };
  return render(<CartItemInstructionsEditor {...defaults} {...props} />);
}

describe('CartItemInstructionsEditor', () => {
  it('shows the Add Instructions button even for a customized item (regression: was hidden on prod)', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: 'Add Instructions' })).toBeInTheDocument();
  });

  it('echoes existing instructions and offers Edit Instructions', () => {
    renderEditor({
      item: {
        quantity: 1,
        selectedIngredientNames: ['Cheese'],
        specialInstructions: 'No onions',
      } as unknown as CartItem,
    });
    expect(screen.getByText(/No onions/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Instructions' })).toBeInTheDocument();
  });

  it('Save forwards (itemId, quantity, value) — the backend update preserves customizations', () => {
    const onSaveInstructions = jest.fn();
    renderEditor({ editingInstructions: 'bi-1', instructionsValue: 'Extra napkins', onSaveInstructions });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSaveInstructions).toHaveBeenCalledWith('bi-1', 2, 'Extra napkins');
  });

  it('Edit Instructions enters edit mode seeded with the current note', () => {
    const setEditingInstructions = jest.fn();
    const setInstructionsValue = jest.fn();
    renderEditor({
      item: {
        quantity: 1,
        selectedIngredientNames: ['Cheese'],
        specialInstructions: 'No onions',
      } as unknown as CartItem,
      setEditingInstructions,
      setInstructionsValue,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Instructions' }));
    expect(setEditingInstructions).toHaveBeenCalledWith('bi-1');
    expect(setInstructionsValue).toHaveBeenCalledWith('No onions');
  });

  it('in edit mode, typing updates the value and Cancel resets', () => {
    const setEditingInstructions = jest.fn();
    const setInstructionsValue = jest.fn();
    renderEditor({
      editingInstructions: 'bi-1',
      instructionsValue: 'draft',
      setEditingInstructions,
      setInstructionsValue,
    });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Extra sauce' } });
    expect(setInstructionsValue).toHaveBeenCalledWith('Extra sauce');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(setEditingInstructions).toHaveBeenCalledWith(null);
    expect(setInstructionsValue).toHaveBeenCalledWith('');
  });
});

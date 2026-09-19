import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CashierNewSaleTicket from './CashierNewSaleTicket';
import type { CashierNewSaleDraftLine } from '@/lib/cashierNewSaleDraft';
import type { OrderDto } from '@/types/order';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const line: CashierNewSaleDraftLine = {
  product: { id: 'p1', name: 'Espresso' },
  quantity: 2,
  variationId: 'v1',
  variationName: 'Large',
  notes: 'Large | Add: Bacon',
  unitPrice: 4.5,
  selectedIngredientIds: [],
};

const quote = { id: 'q-1', total: 9 } as OrderDto;

const baseProps = (overrides: Record<string, unknown> = {}) => ({
  lines: [line] as readonly CashierNewSaleDraftLine[],
  ticketTotal: 9,
  quote: null,
  phase: 'idle' as const,
  notes: '',
  onNotesChange: jest.fn(),
  onSetQuantity: jest.fn(),
  onRemove: jest.fn(),
  canUndo: false,
  onUndo: jest.fn(),
  onReview: jest.fn(),
  disabled: false,
  ...overrides,
});

describe('CashierNewSaleTicket', () => {
  it('renders the line with its variation, notes and quantity', () => {
    render(<CashierNewSaleTicket {...baseProps()} />);

    expect(screen.getByText('Espresso')).toBeInTheDocument();
    expect(screen.getByText('Large')).toBeInTheDocument();
    expect(screen.getByText('Large | Add: Bacon')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows the empty sentence and disables Review & collect on an empty ticket', () => {
    render(<CashierNewSaleTicket {...baseProps({ lines: [], ticketTotal: 0 })} />);

    expect(screen.getByText('cashier.new_sale.empty_ticket')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'cashier.new_sale.review_and_collect' })).toBeDisabled();
  });

  it('shows the SERVER total once a quote exists, not the running one', () => {
    render(<CashierNewSaleTicket {...baseProps({ quote })} />);

    expect(screen.getByText('cashier.new_sale.total_label')).toBeInTheDocument();
  });

  it('steps a line quantity, removes the line, and offers undo', () => {
    const onSetQuantity = jest.fn();
    const onRemove = jest.fn();
    const onUndo = jest.fn();
    render(<CashierNewSaleTicket {...baseProps({ onSetQuantity, onRemove, onUndo, canUndo: true })} />);

    fireEvent.click(screen.getByRole('button', { name: 'cashier.new_sale.increase_quantity' }));
    expect(onSetQuantity).toHaveBeenCalledWith(0, 3);

    fireEvent.click(screen.getByRole('button', { name: 'cashier.new_sale.decrease_quantity' }));
    expect(onSetQuantity).toHaveBeenCalledWith(0, 1);

    fireEvent.click(screen.getByRole('button', { name: 'cashier.new_sale.remove_line' }));
    expect(onRemove).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByRole('button', { name: 'cashier.new_sale.undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('edits order notes', () => {
    const onNotesChange = jest.fn();
    render(<CashierNewSaleTicket {...baseProps({ onNotesChange })} />);

    fireEvent.change(screen.getByLabelText('cashier.new_sale.notes_label'), { target: { value: 'no sugar' } });
    expect(onNotesChange).toHaveBeenCalledWith('no sugar');
  });

  it('switches to the reviewing label and disables the action while reviewing', () => {
    render(<CashierNewSaleTicket {...baseProps({ phase: 'reviewing', disabled: true })} />);

    expect(screen.getByRole('button', { name: 'cashier.new_sale.reviewing' })).toBeDisabled();
  });
});

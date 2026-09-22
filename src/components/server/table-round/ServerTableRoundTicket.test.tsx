import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import type { OrderItem } from '@/components/catalog/orderItems';
import { SERVER_TABLE_ROUND_NOTES_MAX_LENGTH, serverTableRoundNotesSchema } from '@/schemas/serverTableRound.schema';
import ServerTableRoundTicket from './ServerTableRoundTicket';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) => (values?.count ? `${key}:${values.count}` : key),
  }),
}));

describe('ServerTableRoundTicket', () => {
  const item: OrderItem = { product: { id: 'p1', name: 'Soup' }, quantity: 1, unitPrice: 8 };

  it('pins the backend notes boundary in the Zod schema', () => {
    expect(serverTableRoundNotesSchema.safeParse('').success).toBe(true);
    expect(serverTableRoundNotesSchema.safeParse('x'.repeat(SERVER_TABLE_ROUND_NOTES_MAX_LENGTH)).success).toBe(true);
    const rejected = serverTableRoundNotesSchema.safeParse('x'.repeat(SERVER_TABLE_ROUND_NOTES_MAX_LENGTH + 1));
    expect(rejected.success).toBe(false);
    if (!rejected.success) expect(rejected.error.issues[0]?.message).toBe('server.round.notes_too_long');
  });

  it('blocks review and describes a kitchen note that exceeds the backend limit', () => {
    const onReview = jest.fn();
    render(
      <ServerTableRoundTicket
        items={[item]}
        ticketTotal={8}
        quote={null}
        createdOrder={null}
        phase="idle"
        operationState="idle"
        notes={'x'.repeat(SERVER_TABLE_ROUND_NOTES_MAX_LENGTH + 1)}
        onNotesChange={jest.fn()}
        onSetQuantity={jest.fn()}
        onRemove={jest.fn()}
        onReview={onReview}
        canCompose
      />,
    );

    const notes = screen.getByRole('textbox', { name: 'server.round.notes' });
    expect(notes).toHaveAccessibleDescription('server.round.notes_too_long');
    const send = screen.getByRole('button', { name: 'server.round.send' });
    expect(send).toBeDisabled();
    fireEvent.click(send);
    expect(onReview).not.toHaveBeenCalled();
  });

  it('allows review when the kitchen note is valid', () => {
    const onReview = jest.fn();
    render(
      <ServerTableRoundTicket
        items={[item]}
        ticketTotal={8}
        quote={null}
        createdOrder={null}
        phase="idle"
        operationState="idle"
        notes="No onions"
        onNotesChange={jest.fn()}
        onSetQuantity={jest.fn()}
        onRemove={jest.fn()}
        onReview={onReview}
        canCompose
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'server.round.send' }));
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('does not claim printed and freezes an unknown operation', () => {
    render(
      <ServerTableRoundTicket
        items={[]}
        ticketTotal={0}
        quote={null}
        createdOrder={null}
        phase="idle"
        operationState="unknown"
        notes=""
        onNotesChange={jest.fn()}
        onSetQuantity={jest.fn()}
        onRemove={jest.fn()}
        onReview={jest.fn()}
        canCompose
      />,
    );
    expect(screen.queryByText(/printed/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'server.round.send' })).toBeDisabled();
  });
});

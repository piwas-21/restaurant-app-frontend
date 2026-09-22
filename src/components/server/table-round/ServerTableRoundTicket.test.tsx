import { render, screen } from '@testing-library/react';
import ServerTableRoundTicket from './ServerTableRoundTicket';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) => (values?.count ? `${key}:${values.count}` : key),
  }),
}));

describe('ServerTableRoundTicket', () => {
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

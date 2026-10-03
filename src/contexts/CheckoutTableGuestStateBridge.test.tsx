import { render, screen } from '@testing-library/react';
import { CheckoutTableGuestStateContext } from './CheckoutTableGuestStateContext';
import CheckoutTableGuestStateBridge from './CheckoutTableGuestStateBridge';
import { TableGuestVisitContext, type TableGuestVisitContextValue } from './TableGuestVisitContext';

function GuestStateProbe() {
  return (
    <CheckoutTableGuestStateContext.Consumer>
      {(state) => (
        <output>
          {`${state.phase}:${state.hasPendingRound ? 'pending' : 'none'}:${state.hasAcknowledgement ? 'ack' : 'none'}`}
        </output>
      )}
    </CheckoutTableGuestStateContext.Consumer>
  );
}

function renderBridge(value: Partial<TableGuestVisitContextValue>) {
  return render(
    <TableGuestVisitContext.Provider value={value as TableGuestVisitContextValue}>
      <CheckoutTableGuestStateBridge>
        <GuestStateProbe />
      </CheckoutTableGuestStateBridge>
    </TableGuestVisitContext.Provider>,
  );
}

describe('CheckoutTableGuestStateBridge', () => {
  it('keeps an unresolved stored visit and pending round in the checkout loading state', () => {
    renderBridge({
      phase: 'loading',
      pendingRound: { operationId: 'retry-me' } as TableGuestVisitContextValue['pendingRound'],
      pendingRoundStatus: 'known',
      lastRoundAcknowledgement: null,
    });

    expect(screen.getByRole('status')).toHaveTextContent('loading:pending:none');
  });

  it('treats saved-state hydration as unresolved until it proves no round is pending', () => {
    renderBridge({
      phase: 'loading',
      pendingRound: null,
      pendingRoundStatus: 'known',
      lastRoundAcknowledgement: null,
    });

    expect(screen.getByRole('status')).toHaveTextContent('loading:pending:none');
  });

  it('projects authoritative flag-off with no saved visit as the legacy-compatible state', () => {
    renderBridge({
      phase: 'notJoined',
      featureEnabled: false,
      pendingRound: null,
      pendingRoundStatus: 'known',
      lastRoundAcknowledgement: null,
    });

    expect(screen.getByRole('status')).toHaveTextContent('notJoined:none:none');
  });

  it('blocks the checkout bridge when pending-round storage cannot prove there is no operation', () => {
    renderBridge({
      phase: 'active',
      pendingRound: null,
      pendingRoundStatus: 'unknown',
      lastRoundAcknowledgement: null,
    });

    expect(screen.getByRole('status')).toHaveTextContent('active:pending:none');
  });
});

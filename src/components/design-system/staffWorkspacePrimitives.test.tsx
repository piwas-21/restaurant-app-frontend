import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import StaffWorkspaceShell from './StaffWorkspaceShell';
import OperationalSplitView from './OperationalSplitView';
import StickyActionBar from './StickyActionBar';
import TableServiceStrip from './TableServiceStrip';
import QuantityStepper from './QuantityStepper';
import ModifierSheet from './ModifierSheet';
import ConnectionStateBanner from './ConnectionStateBanner';
import DraftRecoveryBanner from './DraftRecoveryBanner';
import OperationResultNotice from './OperationResultNotice';
import controlStyles from './StaffWorkspaceControls.module.css';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en' },
  }),
}));

describe('staff workspace primitives', () => {
  it('renders tenant, location, user, route navigation, connectivity and logout actions', () => {
    const logout = jest.fn();
    render(
      <StaffWorkspaceShell
        tenantName="RUMI"
        locationName="Geneva"
        userName="Ada"
        userRole="Server"
        connectionState="connected"
        navItems={[{ href: '/server', label: 'Floor', active: true }]}
        onLogout={logout}
      >
        <p>workspace</p>
      </StaffWorkspaceShell>,
    );

    expect(screen.getByText('RUMI')).toBeInTheDocument();
    expect(screen.getByText('Geneva')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Staff identity' })).toBeInTheDocument();
    const floorLink = screen.getByRole('link', { name: 'Floor' });
    expect(floorLink).toHaveAttribute('data-active', 'true');
    expect(floorLink).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('only intercepts unmodified primary navigation clicks', () => {
    const navigate = jest.fn();
    render(
      <StaffWorkspaceShell navItems={[{ href: '/server', label: 'Floor' }]} onNavigate={navigate}>
        <p>workspace</p>
      </StaffWorkspaceShell>,
    );

    const link = screen.getByRole('link', { name: 'Floor' });
    fireEvent.click(link, { button: 1 });
    fireEvent.click(link, { metaKey: true });
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(link);
    expect(navigate).toHaveBeenCalledWith('/server');
  });

  it('consumes shared CSS module classes on the rendered controls', () => {
    render(
      <>
        <StickyActionBar primaryAction={<button>Collect</button>} />
        <QuantityStepper value={1} onChange={jest.fn()} />
      </>,
    );
    expect(screen.getByRole('complementary')).toHaveClass(controlStyles.bar);
    expect(screen.getByRole('button', { name: 'decrease_quantity_of_item' })).toHaveClass(controlStyles.stepButton);
  });

  it('shows one pane and a back action when a measured layout is forced narrow', () => {
    const back = jest.fn();
    render(
      <OperationalSplitView
        master={<div>queue</div>}
        detail={<div>ticket</div>}
        detailOpen
        onBack={back}
        forceSinglePane
      />,
    );

    expect(screen.getByRole('region')).toHaveAttribute('data-layout', 'single');
    expect(screen.getByText('queue').parentElement).toHaveAttribute('data-hidden', 'true');
    expect(screen.getByText('ticket')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('keeps a primary action and context in a safe-area-aware sticky bar', () => {
    render(
      <StickyActionBar
        context={<span>Table 4</span>}
        total={<span>CHF 18.50</span>}
        primaryAction={<button>Collect</button>}
      />,
    );
    expect(screen.getByRole('complementary', { name: 'Actions' })).toContainElement(screen.getByText('CHF 18.50'));
    expect(screen.getByRole('button', { name: 'Collect' })).toBeInTheDocument();
  });

  it('renders a canonical table state with elapsed age and balance', () => {
    render(<TableServiceStrip tableLabel="T-QA" state="occupied" elapsedMinutes={12} balance={18.5} />);
    expect(screen.getByRole('region', { name: /Table T-QA.*12.*CHF 18.50/ })).toBeInTheDocument();
    expect(screen.getByText('server.status_occupied')).toBeInTheDocument();
    expect(screen.getByText('CHF 18.50')).toBeInTheDocument();
  });

  it('clamps quantity, exposes labels and invokes removal at the minimum', () => {
    const onChange = jest.fn();
    const onRemove = jest.fn();
    render(<QuantityStepper value={1} min={1} max={3} itemName="Soup" onChange={onChange} onRemove={onRemove} />);

    expect(screen.getByRole('group', { name: 'Quantity Soup' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove item' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove item' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'increase_quantity_of_item' }));
    expect(onChange).toHaveBeenCalledWith(2);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '99' } });
    expect(onChange).toHaveBeenLastCalledWith(3);
  });

  it('uses BaseModal for modifier content and keeps pending actions protected', () => {
    const close = jest.fn();
    const confirm = jest.fn();
    render(
      <ModifierSheet isOpen onClose={close} title="Soup" onConfirm={confirm} isPending>
        <p>Modifiers</p>
      </ModifierSheet>,
    );

    expect(screen.getByRole('dialog', { name: 'Soup' })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('data-presentation', 'responsive-sheet');
    expect(screen.getByRole('dialog').className).toContain('responsiveSheetDialog');
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(close).not.toHaveBeenCalled();
  });

  it.each(['connected', 'reconnecting', 'stale', 'offline'] as const)(
    'communicates %s truth without a live claim',
    (state) => {
      render(<ConnectionStateBanner state={state} lastConfirmed="2026-09-16T10:00:00Z" onRetry={jest.fn()} />);
      expect(screen.getByRole('status')).toHaveAttribute('data-state', state);
      expect(screen.getByText(/server\.|cashier\./)).toBeInTheDocument();
    },
  );

  it('normalizes Cashier stream connectivity values into canonical metadata', () => {
    render(<ConnectionStateBanner state="connecting" />);
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'reconnecting');
  });

  it('keeps a connection error visible beside its last confirmed timestamp', () => {
    render(
      <ConnectionStateBanner
        state="stale"
        lastConfirmed="2026-09-16T10:00:00Z"
        error="Stream unavailable"
        onRetry={jest.fn()}
      />,
    );
    expect(screen.getByText(/Last confirmed/)).toBeInTheDocument();
    expect(screen.getByText('Stream unavailable')).toBeInTheDocument();
  });

  it('keeps compact connectivity retry available with a touch-sized target', () => {
    render(<ConnectionStateBanner state="offline" compact onRetry={jest.fn()} />);
    const retry = screen.getByRole('button', { name: 'Retry' });
    expect(retry).toBeInTheDocument();
    expect(retry.className).toContain('iconButton');
  });

  it('offers scoped draft recovery and operation reconciliation', () => {
    const resume = jest.fn();
    const discard = jest.fn();
    const reconcile = jest.fn();
    render(
      <>
        <DraftRecoveryBanner scopeLabel="Table T-QA" onResume={resume} onDiscard={discard} />
        <OperationResultNotice
          state="unknown"
          operationId="op-123"
          message="Payment result is not confirmed"
          onReconcile={reconcile}
        />
      </>,
    );
    expect(screen.getByRole('region', { name: 'Draft recovery' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resume draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check result' }));
    expect(resume).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(screen.getByText('op-123')).toBeInTheDocument();
  });
});

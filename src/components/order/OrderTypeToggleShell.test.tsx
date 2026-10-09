import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { OrderType } from '@/types/order';
import OrderTypeToggleShell from './OrderTypeToggleShell';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

let mockOrderTypeState: { orderType: OrderType | undefined };
let mockEnabledState: { enabled: OrderType[]; loading: boolean };
let mockTableGuestState: {
  visitBound: boolean;
  active: boolean;
  blocked: boolean;
};

jest.mock('@/contexts/OrderTypeContext', () => ({
  useOrderType: () => ({ state: mockOrderTypeState }),
}));
jest.mock('@/hooks/checkout/useEnabledOrderTypes', () => ({
  useEnabledOrderTypes: () => mockEnabledState,
}));
jest.mock('@/hooks/checkout/useTableGuestDineInAvailability', () => ({
  useTableGuestDineInAvailability: () => mockTableGuestState,
}));

const styles = {
  group: 'group',
  button: 'button',
  active: 'active',
  icon: 'icon',
  label: 'label',
  skeleton: 'skeleton',
  needsChoice: 'needsChoice',
} as const;

describe('OrderTypeToggleShell', () => {
  beforeEach(() => {
    mockOrderTypeState = { orderType: OrderType.DineIn };
    mockEnabledState = { enabled: [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery], loading: false };
    mockTableGuestState = { visitBound: false, active: false, blocked: false };
  });

  it('renders a button per enabled type with the active one pressed', () => {
    render(<OrderTypeToggleShell onPick={() => {}} styles={styles} />);
    expect(screen.getByRole('button', { name: /Dine In/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Takeaway/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Delivery/ })).toBeInTheDocument();
  });

  it('disables every order-type choice while checkout resolves prerequisites', () => {
    render(<OrderTypeToggleShell onPick={() => {}} styles={styles} disabled />);
    expect(screen.getByRole('group', { name: 'Order type' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Takeaway/ })).toBeDisabled();
  });

  it('renders only the admin-enabled subset', () => {
    mockEnabledState = { enabled: [OrderType.Takeaway], loading: false };
    render(<OrderTypeToggleShell onPick={() => {}} styles={styles} />);
    expect(screen.queryByRole('button', { name: /Dine In/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Takeaway/ })).toBeInTheDocument();
  });

  it('holds an active table visit when Dine-In is unavailable instead of offering other channels', () => {
    mockTableGuestState = { visitBound: true, active: true, blocked: true };

    render(<OrderTypeToggleShell onPick={() => {}} styles={styles} />);

    const status = screen.getByRole('status');
    expect(status.tagName).toBe('OUTPUT');
    expect(status).toHaveTextContent('table_guest_dine_in_unavailable');
    expect(screen.queryByRole('button', { name: /Takeaway|Delivery/ })).not.toBeInTheDocument();
    expect(status.closest('div')).toContainElement(
      screen.getByRole('button', { name: 'table_guest_unavailable_retry_action' }),
    );
  });

  it('keeps an available active visit pinned to Dine-In only', () => {
    mockTableGuestState = { visitBound: true, active: true, blocked: false };

    render(<OrderTypeToggleShell onPick={() => {}} styles={styles} />);

    expect(screen.getByRole('button', { name: /Dine In/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Takeaway|Delivery/ })).not.toBeInTheDocument();
  });

  it('renders a spacer skeleton (no group) while the enabled list is loading', () => {
    mockEnabledState = { enabled: [], loading: true };
    const { container } = render(<OrderTypeToggleShell onPick={() => {}} styles={styles} />);
    expect(container.querySelector('.skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('calls onPick with the clicked type', () => {
    const onPick = jest.fn();
    render(<OrderTypeToggleShell onPick={onPick} styles={styles} />);
    fireEvent.click(screen.getByRole('button', { name: /Takeaway/ }));
    expect(onPick).toHaveBeenCalledWith(OrderType.Takeaway);
  });

  describe('focusSignal', () => {
    // jsdom implements no layout, so `Element.prototype.scrollIntoView` does not exist there and an
    // unstubbed call throws inside the effect. Stubbed rather than made optional in the component:
    // the method is universal in browsers, and `?.` there would be coding around the test runner.
    beforeAll(() => {
      Element.prototype.scrollIntoView = jest.fn();
    });

    /**
     * The behaviour the reported gap needed: pressing Proceed with no order type printed a
     * sentence and otherwise did nothing, so the click now brings the guest TO the control. The
     * signal is a counter rather than a boolean precisely so a second refusal acts again — the
     * third case below is the one a boolean would fail.
     */
    it('does nothing while no click has been refused', () => {
      render(<OrderTypeToggleShell onPick={() => {}} styles={styles} />);
      expect(document.activeElement).toBe(document.body);
      expect(screen.getByRole('group')).not.toHaveClass('needsChoice');
    });

    it('focuses the first type and marks the group once a click is refused', () => {
      render(<OrderTypeToggleShell onPick={() => {}} styles={styles} focusSignal={1} />);
      expect(screen.getByRole('button', { name: /Dine In/ })).toHaveFocus();
      expect(screen.getByRole('group')).toHaveClass('needsChoice');
    });

    /**
     * The CTA stays live while `useEnabledOrderTypes` is out (only an empty cart disables it), so a
     * refusal can land on the ref-less SKELETON. Keyed on `focusSignal` alone the effect never ran
     * again once the buttons mounted — the guest got the outline and no focus, i.e. the do-nothing
     * click this feature exists to remove, until they clicked a second time.
     */
    it('services a refusal that arrived while the enabled list was still loading', () => {
      mockEnabledState = { enabled: [], loading: true };
      const { rerender } = render(<OrderTypeToggleShell onPick={() => {}} styles={styles} focusSignal={1} />);
      expect(screen.queryByRole('group')).not.toBeInTheDocument();

      mockEnabledState = { enabled: [OrderType.DineIn, OrderType.Takeaway], loading: false };
      rerender(<OrderTypeToggleShell onPick={() => {}} styles={styles} focusSignal={1} />);
      expect(screen.getByRole('button', { name: /Dine In/ })).toHaveFocus();
    });

    it('services one refusal ONCE — an unrelated change to the enabled list does not re-steal focus', () => {
      const { rerender } = render(<OrderTypeToggleShell onPick={() => {}} styles={styles} focusSignal={1} />);
      screen.getByRole('button', { name: /Takeaway/ }).focus();

      // Delivery leaves the admin-enabled list — a real re-render of this effect's new deps, with
      // the focused button (Takeaway) still present so the assertion is about focus and not
      // about the element having been unmounted underneath it.
      mockEnabledState = { enabled: [OrderType.DineIn, OrderType.Takeaway], loading: false };
      rerender(<OrderTypeToggleShell onPick={() => {}} styles={styles} focusSignal={1} />);
      expect(screen.getByRole('button', { name: /Takeaway/ })).toHaveFocus();
    });

    /** The focus move arrives with its reason: the sentence is on screen BEFORE the click, so its
     *  live region announces nothing on a refusal. */
    it("points the group at the surface's blocker sentence, and only once refused", () => {
      const { rerender } = render(
        <OrderTypeToggleShell onPick={() => {}} styles={styles} focusSignal={0} blockerHintId="hint-1" />,
      );
      expect(screen.getByRole('group')).not.toHaveAttribute('aria-describedby');

      rerender(<OrderTypeToggleShell onPick={() => {}} styles={styles} focusSignal={1} blockerHintId="hint-1" />);
      expect(screen.getByRole('group')).toHaveAttribute('aria-describedby', 'hint-1');
    });

    it('acts again on a SECOND refusal', () => {
      const { rerender } = render(<OrderTypeToggleShell onPick={() => {}} styles={styles} focusSignal={1} />);
      screen.getByRole('button', { name: /Delivery/ }).focus();
      rerender(<OrderTypeToggleShell onPick={() => {}} styles={styles} focusSignal={2} />);
      expect(screen.getByRole('button', { name: /Dine In/ })).toHaveFocus();
    });
  });
});

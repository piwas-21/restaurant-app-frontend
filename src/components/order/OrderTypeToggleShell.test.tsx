import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { OrderType } from '@/types/order';
import OrderTypeToggleShell from './OrderTypeToggleShell';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

let mockOrderTypeState: { orderType: OrderType | undefined };
let mockEnabledState: { enabled: OrderType[]; loading: boolean };

jest.mock('@/contexts/OrderTypeContext', () => ({
  useOrderType: () => ({ state: mockOrderTypeState }),
}));
jest.mock('@/hooks/checkout/useEnabledOrderTypes', () => ({
  useEnabledOrderTypes: () => mockEnabledState,
}));

const styles = {
  group: 'group',
  button: 'button',
  active: 'active',
  icon: 'icon',
  label: 'label',
  skeleton: 'skeleton',
} as const;

describe('OrderTypeToggleShell', () => {
  beforeEach(() => {
    mockOrderTypeState = { orderType: OrderType.DineIn };
    mockEnabledState = { enabled: [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery], loading: false };
  });

  it('renders a button per enabled type with the active one pressed', () => {
    render(<OrderTypeToggleShell onPick={() => {}} styles={styles} />);
    expect(screen.getByRole('button', { name: /Dine In/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Takeaway/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Delivery/ })).toBeInTheDocument();
  });

  it('renders only the admin-enabled subset', () => {
    mockEnabledState = { enabled: [OrderType.Takeaway], loading: false };
    render(<OrderTypeToggleShell onPick={() => {}} styles={styles} />);
    expect(screen.queryByRole('button', { name: /Dine In/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Takeaway/ })).toBeInTheDocument();
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
});

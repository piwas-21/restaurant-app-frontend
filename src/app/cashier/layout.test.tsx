import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import CashierLayout from './layout';

const mockPush = jest.fn();
const mockAuth = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/components/AuthContext', () => ({ useAuth: () => mockAuth() }));

describe('CashierLayout authorization', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockAuth.mockReturnValue({ user: { role: 'cashier' }, isLoading: false });
  });

  it('does not render cashier children for another authenticated role', () => {
    mockAuth.mockReturnValue({ user: { role: 'server' }, isLoading: false });
    render(
      <CashierLayout>
        <p>private queue</p>
      </CashierLayout>,
    );

    expect(screen.queryByText('private queue')).not.toBeInTheDocument();
    // An unauthorized but signed-in user reads why the screen is empty instead of a blank page.
    expect(screen.getByText('cashier.workspace.not_authorized')).toBeInTheDocument();
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('renders children for cashier and admin roles', () => {
    const { rerender } = render(
      <CashierLayout>
        <p>private queue</p>
      </CashierLayout>,
    );
    expect(screen.getByText('private queue')).toBeInTheDocument();

    mockAuth.mockReturnValue({ user: { role: 'ADMIN' }, isLoading: false });
    rerender(
      <CashierLayout>
        <p>private queue</p>
      </CashierLayout>,
    );
    expect(screen.getByText('private queue')).toBeInTheDocument();
  });
});

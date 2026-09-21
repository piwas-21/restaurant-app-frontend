import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ServerLayout from './layout';

const mockPush = jest.fn();
const mockAuth = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/components/AuthContext', () => ({ useAuth: () => mockAuth() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('ServerLayout authorization', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockAuth.mockReturnValue({ user: { role: 'server' }, isLoading: false });
  });

  it('does not render server content for another authenticated role', () => {
    mockAuth.mockReturnValue({ user: { role: 'cashier' }, isLoading: false });
    render(
      <ServerLayout>
        <p>private server workspace</p>
      </ServerLayout>,
    );

    expect(screen.queryByText('private server workspace')).not.toBeInTheDocument();
    expect(screen.getByText('server.takeaway.not_authorized')).toBeInTheDocument();
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it.each(['server', 'ADMIN'])('renders children for the %s role', (role) => {
    mockAuth.mockReturnValue({ user: { role }, isLoading: false });
    render(
      <ServerLayout>
        <p>private server workspace</p>
      </ServerLayout>,
    );
    expect(screen.getByText('private server workspace')).toBeInTheDocument();
  });
});

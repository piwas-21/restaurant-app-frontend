import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
// The REAL i18n instance, deliberately. A mocked `t` that echoes its argument would make this whole
// suite pass with the bug reinstated — the defect IS what i18next does to text that is not a key.
import '../../../i18n';
import MemberManagementPage from './page';
import type { UserDto } from '@/types/user';

const mockUser = { id: 'u1', firstName: 'Ada', lastName: 'Lovelace', role: 'Server', isDeleted: false } as UserDto;

const mockGetUsers = jest.fn().mockResolvedValue(undefined);
const mockHandleDeleteUser = jest.fn();
const mockHandleUpdateUser = jest.fn();
const mockHandleReactivateUser = jest.fn();

jest.mock('@/hooks/useMemberManagement', () => ({
  useMemberManagement: () => ({
    users: [mockUser],
    totalCount: 1,
    isLoading: false,
    error: null,
    getUsers: mockGetUsers,
    handleDeleteUser: mockHandleDeleteUser,
    handleUpdateUser: mockHandleUpdateUser,
    handleReactivateUser: mockHandleReactivateUser,
  }),
}));

// Everything that is not the message path: the guard needs an auth context, the statistics panel
// and the register modal both reach for the network on mount.
jest.mock('@/components/admin/AdminAuthGuard', () => ({
  AdminAuthGuard: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/admin/member-management/UserStatistics', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/admin/RegisterStaffModal', () => ({ __esModule: true, default: () => null }));
interface FilterStub {
  setActiveTab: (tab: string) => void;
}
jest.mock('@/components/admin/member-management/FilterControls', () => ({
  __esModule: true,
  default: ({ setActiveTab }: FilterStub) => <button onClick={() => setActiveTab('staff')}>staff tab</button>,
}));

interface TableStub {
  users: UserDto[];
  onEdit: (user: UserDto) => void;
  onDelete: (user: UserDto) => void;
  onReactivate?: (user: UserDto) => void;
}
jest.mock('@/components/admin/member-management/MembersTable', () => ({
  __esModule: true,
  default: ({ users, onEdit, onDelete, onReactivate }: TableStub) => (
    <div>
      {users.map((user) => (
        <div key={user.id}>
          <button onClick={() => onEdit(user)}>edit</button>
          <button onClick={() => onDelete(user)}>delete</button>
          <button onClick={() => onReactivate?.(user)}>reactivate</button>
        </div>
      ))}
    </div>
  ),
}));

interface EditModalStub {
  isOpen: boolean;
  onSave: (updated: Partial<UserDto>) => Promise<void>;
}
jest.mock('@/components/admin/member-management/EditUserModal', () => ({
  __esModule: true,
  default: ({ isOpen, onSave }: EditModalStub) =>
    isOpen ? <button onClick={() => void onSave({ firstName: 'Grace' })}>save</button> : null,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * E9 (#383) — the half of the fix that no hook test can see.
 *
 * `ResultModal` renders `message` raw (`<p>{message}</p>`), and this page used to hand it
 * `t(result.message || 'User updated successfully')`. Running a finished sentence back through
 * `t()` is a lookup, and i18next answers a lookup two ways that both lose the sentence:
 *
 * - it splits on `nsSeparator` (`':'`, never overridden in `src/i18n.ts`) when the text does not
 *   look like natural language — `"User.NotFound: no such user"` comes back as `" no such user"`;
 * - it RESOLVES the text when it happens to collide with one of the 2400+ keys — a server message
 *   of `"details"` comes back as `"Details"`.
 *
 * (The plainer `"Error: email already in use"` survives, because i18next ≥21 skips the namespace
 * split for keys containing spaces. The wrapper was wrong in principle and wrong on a narrower set
 * of inputs than "anything with a colon" — both of which are reasons to delete it, not to keep it.)
 */
describe('member management — the sentence that reaches the modal', () => {
  const clickButton = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

  const save = () => {
    render(<MemberManagementPage />);
    clickButton('edit');
    clickButton('save');
  };

  it("shows a failed update's server sentence whole, not the fragment after the colon", async () => {
    mockHandleUpdateUser.mockResolvedValue({ success: false, message: 'User.NotFound: no such user' });

    save();

    expect(await screen.findByText('User.NotFound: no such user')).toBeInTheDocument();
    expect(screen.queryByText('no such user')).not.toBeInTheDocument();
  });

  it('does not resolve a server sentence that collides with an i18n key', async () => {
    mockHandleUpdateUser.mockResolvedValue({ success: false, message: 'details' });

    save();

    expect(await screen.findByText('details')).toBeInTheDocument();
    expect(screen.queryByText('Details')).not.toBeInTheDocument();
  });

  it('reports a failed update under the error heading, not the success one', async () => {
    mockHandleUpdateUser.mockResolvedValue({ success: false, message: 'Email already in use' });

    save();

    expect(await screen.findByText('Email already in use')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Error' })).toBeInTheDocument();
  });

  /**
   * The page used to build the success sentence itself and print it whichever way the call went, so
   * a refused delete told the admin "User deleted successfully" under the red "Error" heading.
   */
  it('shows why a delete was refused rather than reporting it as done', async () => {
    mockHandleDeleteUser.mockResolvedValue({ success: false, message: 'User still owns 3 open orders' });
    render(<MemberManagementPage />);

    clickButton('delete');
    clickButton('Yes');

    expect(await screen.findByText('User still owns 3 open orders')).toBeInTheDocument();
    expect(screen.queryByText('User deleted successfully')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Error' })).toBeInTheDocument();
  });

  it('shows why a reactivation was refused rather than reporting it as done', async () => {
    mockHandleReactivateUser.mockResolvedValue({ success: false, message: 'Account is not soft-deleted' });
    render(<MemberManagementPage />);

    clickButton('reactivate');

    expect(await screen.findByText('Account is not soft-deleted')).toBeInTheDocument();
    expect(screen.queryByText('User reactivated successfully')).not.toBeInTheDocument();
  });

  /**
   * `DeleteUserCommand` forces `shouldHardDelete` for every staff role whatever flag we send, and
   * the confirmation on this tab already warns "cannot be undone" — but the result was derived from
   * `isDeleted`, which is always false for staff. So the screen confirmed an irreversible delete
   * and then reported the restorable wording for it.
   */
  it('reports a staff delete as permanent, matching the warning the admin just confirmed', async () => {
    mockHandleDeleteUser.mockResolvedValue({ success: true, message: 'User permanently deleted' });
    render(<MemberManagementPage />);

    clickButton('staff tab');
    clickButton('delete');
    expect(screen.getByText(/permanently delete/i)).toBeInTheDocument();
    clickButton('Yes');

    expect(mockHandleDeleteUser).toHaveBeenCalledWith('u1', true);
    expect(await screen.findByText('User permanently deleted')).toBeInTheDocument();
  });

  it('still reports a successful delete, in the wording the hook chose', async () => {
    mockHandleDeleteUser.mockResolvedValue({ success: true, message: 'User deleted successfully' });
    render(<MemberManagementPage />);

    clickButton('delete');
    clickButton('Yes');

    expect(await screen.findByText('User deleted successfully')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Success' })).toBeInTheDocument();
  });
});

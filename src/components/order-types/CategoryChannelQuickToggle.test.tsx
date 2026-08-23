import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/components/AuthContext';
import { getCategories, updateCategoryOrderTypes } from '@/services/categoryService';
import CategoryChannelQuickToggle from './CategoryChannelQuickToggle';

jest.mock('@/services/categoryService');
jest.mock('@/components/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallbackOrOptions?: unknown, options?: Record<string, unknown>) => {
      const fallback = typeof fallbackOrOptions === 'string' ? fallbackOrOptions : key;
      const vars = (typeof fallbackOrOptions === 'object' ? fallbackOrOptions : options) as
        Record<string, unknown> | undefined;
      const text = typeof vars?.defaultValue === 'string' ? vars.defaultValue : fallback;
      return Object.entries(vars ?? {}).reduce(
        (out, [name, value]) => out.replaceAll(`{{${name}}}`, String(value)),
        text,
      );
    },
  }),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetCategories = getCategories as jest.MockedFunction<typeof getCategories>;
const mockUpdate = updateCategoryOrderTypes as jest.MockedFunction<typeof updateCategoryOrderTypes>;

const DURUM = {
  id: 'c1',
  name: 'Wraps',
  isActive: true,
  displayOrder: 0,
  availableOrderTypes: 6,
  updatedAt: new Date(Date.now() - 25 * 60_000).toISOString(),
};
const GRILLS = { id: 'c2', name: 'Grills', isActive: true, displayOrder: 1, availableOrderTypes: null };

function signedInAs(role: string | null) {
  mockUseAuth.mockReturnValue({
    user: role === null ? null : { firstName: 'A', lastName: 'B', email: 'a@b.c', role, accessToken: 'x' },
    login: jest.fn(),
    logout: jest.fn(),
    isLoading: false,
  });
}

function mockList(items: unknown[]) {
  mockGetCategories.mockResolvedValue({ success: true, data: { items, totalCount: items.length } } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdate.mockResolvedValue({ success: true } as never);
  mockList([DURUM, GRILLS]);
});

describe('CategoryChannelQuickToggle — who may see it', () => {
  it.each([['Cashier'], ['Server'], ['KitchenStaff'], ['Customer']])(
    'renders nothing for a %s, whose token the writer would 403',
    async (role) => {
      signedInAs(role);
      const { container } = render(<CategoryChannelQuickToggle />);

      expect(container).toBeEmptyDOMElement();
      // …and it must not even READ on their behalf.
      await waitFor(() => expect(mockGetCategories).not.toHaveBeenCalled());
    },
  );

  it('renders nothing when nobody is signed in', () => {
    signedInAs(null);
    const { container } = render(<CategoryChannelQuickToggle />);
    expect(container).toBeEmptyDOMElement();
  });

  it('accepts the role case-insensitively, as the cashier layout does', async () => {
    signedInAs('admin');
    render(<CategoryChannelQuickToggle />);
    await waitFor(() => expect(mockGetCategories).toHaveBeenCalled());
  });
});

describe('CategoryChannelQuickToggle — what it says', () => {
  beforeEach(() => signedInAs('Admin'));

  it('names the CATEGORY and how long it has been closed, not "Dine-In: off"', async () => {
    render(<CategoryChannelQuickToggle />);

    expect(await screen.findByText('Wraps: closed to Dine In · for 25 min')).toBeInTheDocument();
  });

  it('says everything is open when no category is restricted', async () => {
    mockList([GRILLS]);
    render(<CategoryChannelQuickToggle />);

    expect(await screen.findByText('All categories: every order type')).toBeInTheDocument();
  });

  it('opens the panel and writes a channel through the shared writer', async () => {
    render(<CategoryChannelQuickToggle />);
    await screen.findByText('Wraps: closed to Dine In · for 25 min');

    fireEvent.click(screen.getByRole('button', { name: /Order type availability/ }));

    const dineIn = (await screen.findAllByRole('button', { name: 'Dine In' }))[0];
    expect(dineIn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(dineIn);

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }), null));
  });

  it('closes the panel again', async () => {
    render(<CategoryChannelQuickToggle />);
    await screen.findByText('Wraps: closed to Dine In · for 25 min');

    fireEvent.click(screen.getByRole('button', { name: /Order type availability/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('says what it left out, and closes on the way to the full settings screen', async () => {
    mockGetCategories.mockResolvedValue({
      success: true,
      data: { items: [GRILLS, { ...DURUM, isActive: false }], totalCount: 240 },
    } as never);
    render(<CategoryChannelQuickToggle />);
    await screen.findByText('All categories: every order type');

    fireEvent.click(screen.getByRole('button', { name: /Order type availability/ }));
    await screen.findByRole('dialog');
    // 240 held, 1 listed — inactive rows and everything past the page cap, counted rather than
    // silently dropped.
    expect(screen.getByText(/239 categories are not listed here/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Manage' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('says the list is still loading rather than showing an empty panel', async () => {
    mockGetCategories.mockImplementation(() => new Promise(() => {}) as ReturnType<typeof getCategories>);
    render(<CategoryChannelQuickToggle />);

    fireEvent.click(await screen.findByRole('button', { name: /Order type availability/ }));
    await screen.findByRole('dialog');
    // "No categories found" here would read as "nothing is restricted", which is a guess, not a
    // fact. Two nodes say it: the trigger's own summary and the panel body.
    expect(screen.getAllByText('Loading...')).toHaveLength(2);
    expect(screen.queryByText('No categories found')).not.toBeInTheDocument();
  });

  it('says so when the restaurant genuinely has no categories', async () => {
    mockList([]);
    render(<CategoryChannelQuickToggle />);
    await screen.findByText('All categories: every order type');

    fireEvent.click(screen.getByRole('button', { name: /Order type availability/ }));
    expect(await screen.findByText('No categories found')).toBeInTheDocument();
  });

  it('shows a read failure inside the panel instead of an empty list that reads as "all open"', async () => {
    mockGetCategories.mockRejectedValue(new Error('offline'));
    render(<CategoryChannelQuickToggle />);
    await screen.findByText('All categories: every order type');

    fireEvent.click(screen.getByRole('button', { name: /Order type availability/ }));
    expect(await screen.findByText('Failed to load categories')).toBeInTheDocument();
    expect(screen.queryByText('No categories found')).not.toBeInTheDocument();
  });

  it('disables the last open channel rather than letting a tap take a category off sale', async () => {
    mockList([{ ...GRILLS, availableOrderTypes: 2 }]);
    render(<CategoryChannelQuickToggle />);
    await screen.findByText('Grills: closed to Dine In and Delivery');

    fireEvent.click(screen.getByRole('button', { name: /Order type availability/ }));

    expect(await screen.findByRole('button', { name: 'Takeaway' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dine In' })).toBeEnabled();
  });
});

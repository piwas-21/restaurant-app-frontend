import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrderTypeManager from '../OrderTypeManager';
import WorkingHoursManager from '../WorkingHoursManager';
import { orderTypeConfigurationService } from '@/services/orderTypeConfigurationService';
import { workingHoursService } from '@/services/workingHoursService';
import type { WorkingHoursDto } from '@/types/workingHours';
import { ApiError } from '@/utils/apiClient';
import { OrderType } from '@/types/order';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

// Both managers import `enqueueSnackbar` directly rather than through `useSnackbar()`, so the mock
// has to replace the module-level export. (`useTaxConfigurations` uses the hook form — its own
// suite mocks it the other way.)
const mockEnqueueSnackbar = jest.fn();
jest.mock('notistack', () => ({
  enqueueSnackbar: (...args: unknown[]) => mockEnqueueSnackbar(...args),
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
}));

jest.mock('@/services/orderTypeConfigurationService', () => ({
  orderTypeConfigurationService: { getAll: jest.fn(), update: jest.fn() },
}));
jest.mock('@/services/workingHoursService', () => ({
  workingHoursService: { getAll: jest.fn(), isOpenNow: jest.fn(), update: jest.fn() },
}));

const mockOrderTypeGetAll = orderTypeConfigurationService.getAll as jest.MockedFunction<
  typeof orderTypeConfigurationService.getAll
>;
const mockOrderTypeUpdate = orderTypeConfigurationService.update as jest.MockedFunction<
  typeof orderTypeConfigurationService.update
>;
const mockHoursGetAll = workingHoursService.getAll as jest.MockedFunction<typeof workingHoursService.getAll>;
const mockIsOpenNow = workingHoursService.isOpenNow as jest.MockedFunction<typeof workingHoursService.isOpenNow>;
const mockHoursUpdate = workingHoursService.update as jest.MockedFunction<typeof workingHoursService.update>;

/** The message text of the most recent toast, whatever variant it carried. */
const lastToastMessage = () => mockEnqueueSnackbar.mock.calls.at(-1)?.[0];

const errorToastMessages = () =>
  mockEnqueueSnackbar.mock.calls.filter((call) => call[1]?.variant === 'error').map((call) => call[0]);

beforeEach(() => {
  jest.clearAllMocks();
  mockOrderTypeGetAll.mockResolvedValue([
    { orderType: OrderType.DineIn, isEnabled: true, displayName: 'Dine In' },
  ] as never);
  // `as unknown as`, not `as never`: `as never` switches off type checking on the fixture entirely,
  // and the first version of it omitted `id` — which the component uses as the React key AND as the
  // row selector in every edit handler. With one row that is invisible; with two, `wh.id === wh.id`
  // matches every row and an edit to one cell would rewrite them all with the test none the wiser.
  mockHoursGetAll.mockResolvedValue([
    { id: 'wh-mon', dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', isActive: true, isClosed: false, notes: null },
    { id: 'wh-tue', dayOfWeek: 2, openTime: '09:00', closeTime: '17:00', isActive: true, isClosed: false, notes: null },
  ] as unknown as WorkingHoursDto[]);
  mockIsOpenNow.mockResolvedValue(true);
});

/**
 * E9 (#383), admin settings slice. Every assertion is about the SENTENCE the admin reads, not about
 * whether a catch has a binding — the ratchet counts the latter and cannot see the former.
 *
 * These surfaces already had CONTEXTUAL translated fallbacks ("Failed to update working hours"),
 * which is more than most of the sweep started with. What they discarded was the server's own
 * reason, and on these screens the reason is the whole diagnosis: a refused order-type toggle or a
 * refused hours update is almost always a rule ("closing time must be after opening time"), not an
 * outage.
 */
describe('admin settings — what the admin reads when the server refuses', () => {
  describe('OrderTypeManager', () => {
    it("surfaces the server's own sentence when the initial load throws", async () => {
      mockOrderTypeGetAll.mockRejectedValue(new ApiError(503, 'Order-type configuration is being migrated'));

      render(<OrderTypeManager />);

      await waitFor(() => expect(errorToastMessages()).toContain('Order-type configuration is being migrated'));
    });

    it('falls back to a CONTEXTUAL sentence, not a generic one, when the server authored none', async () => {
      mockOrderTypeGetAll.mockRejectedValue(new ApiError(500, ''));

      render(<OrderTypeManager />);

      await waitFor(() => expect(errorToastMessages()).toContain('Failed to load order type configurations'));
      expect(errorToastMessages()).not.toContain('An unexpected error occurred.');
    });

    it("surfaces the server's reason for a refused toggle", async () => {
      mockOrderTypeUpdate.mockRejectedValue(new ApiError(409, 'Delivery has 3 open orders and cannot be disabled'));

      render(<OrderTypeManager />);
      // findBy*, not waitFor(called) — the service resolving is not the same as the list having
      // rendered, and the control does not exist until it has.
      const toggle = (await screen.findAllByRole('checkbox'))[0];
      fireEvent.click(toggle);
      const confirm = await screen.findByRole('button', { name: 'yes' });
      fireEvent.click(confirm);

      await waitFor(() => expect(errorToastMessages()).toContain('Delivery has 3 open orders and cannot be disabled'));
      expect(errorToastMessages()).not.toContain('Failed to update order type');
    });
  });

  describe('WorkingHoursManager', () => {
    it("surfaces the server's own sentence when the load throws", async () => {
      mockHoursGetAll.mockRejectedValue(new ApiError(503, 'Schedule service is restarting'));

      render(<WorkingHoursManager />);

      await waitFor(() => expect(errorToastMessages()).toContain('Schedule service is restarting'));
    });

    it('falls back to the contextual sentence when the server authored none', async () => {
      mockHoursGetAll.mockRejectedValue(new ApiError(500, ''));

      render(<WorkingHoursManager />);

      await waitFor(() => expect(errorToastMessages()).toContain('Failed to load working hours'));
    });

    it("surfaces the server's per-day reason for a refused save", async () => {
      mockHoursUpdate.mockRejectedValue(
        new ApiError(400, 'Validation failed', ['Monday: closing time must be after opening time']),
      );

      render(<WorkingHoursManager />);
      fireEvent.click(await screen.findByRole('button', { name: /Save Changes/i }));

      await waitFor(() => expect(errorToastMessages()).toContain('Monday: closing time must be after opening time'));
      expect(errorToastMessages()).not.toContain('Failed to update working hours');
    });

    /**
     * The one catch in this family that stays unbound. `checkIsOpen` only decides whether an
     * "Open now" badge renders, and `loadWorkingHours` already reports the same outage — a second
     * toast would report it twice and bury the one that matters. Pinned so the next sweep does not
     * "fix" it into noise.
     */
    it('stays silent when only the open-now badge fails', async () => {
      mockIsOpenNow.mockRejectedValue(new ApiError(500, 'is-open probe failed'));

      render(<WorkingHoursManager />);
      await waitFor(() => expect(mockHoursGetAll).toHaveBeenCalled());
      await waitFor(() => expect(mockIsOpenNow).toHaveBeenCalled());

      expect(errorToastMessages()).toHaveLength(0);
      expect(lastToastMessage()).toBeUndefined();
    });

    /**
     * Silence is not the same as doing nothing, and the first version of this slice got that wrong.
     * On the POST-SAVE re-check `loadWorkingHours` has just succeeded, so nothing else reports the
     * failure — and leaving `isOpen` untouched kept the banner asserting the PRE-save answer above
     * a table showing the hours the admin had just changed. Hiding it is the honest outcome.
     */
    it('hides the open-now banner rather than freezing it when the post-save re-check fails', async () => {
      mockIsOpenNow.mockResolvedValueOnce(true).mockRejectedValueOnce(new ApiError(500, 'probe failed'));
      mockHoursUpdate.mockResolvedValue(undefined as never);

      render(<WorkingHoursManager />);
      expect(await screen.findByText('Restaurant is currently OPEN')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

      await waitFor(() => expect(mockIsOpenNow).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByText('Restaurant is currently OPEN')).not.toBeInTheDocument());
      // …and still no toast: the badge is not worth one, it just must not lie.
      expect(errorToastMessages()).toHaveLength(0);
    });
  });
});

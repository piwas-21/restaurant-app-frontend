import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PointRulesPage from './page';
import { adminFidelityService } from '@/services/adminFidelityService';
import { ApiError } from '@/utils/apiClient';

const mockEnqueue = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mockEnqueue }) }));
jest.mock('@/services/adminFidelityService', () => ({
  adminFidelityService: { getPointRules: jest.fn(), deletePointRule: jest.fn() },
}));
jest.mock('@/components/admin/AdminAuthGuard', () => ({
  AdminAuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/admin/PointRuleForm', () => () => null);

const service = adminFidelityService as unknown as {
  getPointRules: jest.Mock;
  deletePointRule: jest.Mock;
};

const RULE = {
  id: 'r1',
  name: 'Lunch bonus',
  minOrderAmount: 10,
  maxOrderAmount: 50,
  pointsAwarded: 20,
  priority: 1,
  isActive: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  service.getPointRules.mockResolvedValue([RULE]);
  service.deletePointRule.mockResolvedValue(undefined);
});

/**
 * The toast shape of the E9 recipe: `getErrorMessage(err) ?? t('contextual')`. `useApiError` is
 * wrong here — it holds state a fire-and-forget snackbar has nowhere to put — and
 * `adminFidelityService` goes through `apiClient`, so a refusal arrives as an `ApiError` carrying
 * the server's sentence.
 */
describe('PointRulesPage — the server’s reason reaches the toast (E9)', () => {
  it('load failure: shows the server’s sentence rather than the generic', async () => {
    service.getPointRules.mockRejectedValue(new ApiError(403, 'Fidelity module is not enabled for this tenant'));
    render(<PointRulesPage />);

    await waitFor(() =>
      expect(mockEnqueue).toHaveBeenCalledWith(
        'Fidelity module is not enabled for this tenant',
        expect.objectContaining({ variant: 'error' }),
      ),
    );
  });

  it('load failure: falls back to the contextual sentence when the server authored none', async () => {
    service.getPointRules.mockRejectedValue(new Error('network'));
    render(<PointRulesPage />);

    await waitFor(() =>
      expect(mockEnqueue).toHaveBeenCalledWith(
        'Failed to load point rules',
        expect.objectContaining({ variant: 'error' }),
      ),
    );
  });

  it('delete failure: shows why the rule could not be deleted', async () => {
    render(<PointRulesPage />);
    await screen.findByText('Lunch bonus');

    service.deletePointRule.mockRejectedValue(new ApiError(409, 'Rule is referenced by an open order'));
    fireEvent.click(screen.getByTitle('Delete'));
    fireEvent.click(await screen.findByRole('button', { name: 'yes' }));

    await waitFor(() =>
      expect(mockEnqueue).toHaveBeenCalledWith(
        'Rule is referenced by an open order',
        expect.objectContaining({ variant: 'error' }),
      ),
    );
  });
});

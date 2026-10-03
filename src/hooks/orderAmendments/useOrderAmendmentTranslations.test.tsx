import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { loadOrderAmendmentTranslations } from '@/lib/orderAmendmentTranslations';
import { useOrderAmendmentTranslations } from './useOrderAmendmentTranslations';

const mockI18n = { language: 'de-CH', resolvedLanguage: 'de' };
const mockLoad = loadOrderAmendmentTranslations as jest.MockedFunction<typeof loadOrderAmendmentTranslations>;

jest.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: mockI18n }) }));
jest.mock('@/lib/orderAmendmentTranslations', () => ({ loadOrderAmendmentTranslations: jest.fn() }));

function Harness({ enabled }: Readonly<{ enabled: boolean }>) {
  const load = useOrderAmendmentTranslations(enabled);
  return (
    <>
      <output>{load.failed ? 'failed' : load.ready ? 'ready' : 'loading'}</output>
      <button type="button" onClick={load.retry}>
        Retry
      </button>
    </>
  );
}

describe('useOrderAmendmentTranslations', () => {
  beforeEach(() => mockLoad.mockReset());

  it('does not request amendment copy when the feature surface is dormant', async () => {
    render(<Harness enabled={false} />);

    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('exposes a failed chunk load and retries on request', async () => {
    mockLoad.mockRejectedValueOnce(new Error('chunk unavailable')).mockResolvedValueOnce(undefined);
    render(<Harness enabled />);

    expect(await screen.findByText('failed')).toBeInTheDocument();
    expect(mockLoad).toHaveBeenCalledWith(expect.objectContaining(mockI18n), 'de');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('ready')).toBeInTheDocument());
    expect(mockLoad).toHaveBeenCalledTimes(2);
  });
});
